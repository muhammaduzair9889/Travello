"""
Payment views for handling Stripe payment processing
"""
import stripe
import logging
import json
import os
from decimal import Decimal
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.db import transaction
from dotenv import load_dotenv

from .models import Booking, Payment
from .payment_serializers import (
    PaymentSerializer, CreatePaymentSessionSerializer,
    BookingPaymentStatusSerializer
)
from .permissions import CanAccessPayments
from travello_backend.utils import get_safe_error_response, validate_api_key

logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Configure Stripe - Using settings with validation
STRIPE_SECRET_KEY = settings.STRIPE_SECRET_KEY or os.getenv('STRIPE_SECRET_KEY', '')
STRIPE_PUBLISHABLE_KEY = settings.STRIPE_PUBLISHABLE_KEY or os.getenv('STRIPE_PUBLISHABLE_KEY', '')
STRIPE_WEBHOOK_SECRET = settings.STRIPE_WEBHOOK_SECRET or os.getenv('STRIPE_WEBHOOK_SECRET', '')

# Validate Stripe keys are configured
if not all([STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET]):
    logger.warning('Stripe keys not properly configured in settings or environment')

if STRIPE_SECRET_KEY:
    stripe.api_key = STRIPE_SECRET_KEY

# Currency settings
STRIPE_CURRENCY_PRIMARY = getattr(settings, 'STRIPE_CURRENCY_PRIMARY', 'PKR').lower()
STRIPE_CURRENCY_FALLBACK = getattr(settings, 'STRIPE_CURRENCY_FALLBACK', 'USD').lower()

# Frontend URLs - Must be set in production
FRONTEND_SUCCESS_URL = getattr(settings, 'FRONTEND_PAYMENT_SUCCESS_URL', 'http://localhost:3000/payment-success')
FRONTEND_CANCEL_URL = getattr(settings, 'FRONTEND_PAYMENT_CANCEL_URL', 'http://localhost:3000/payment-cancel')

# Validate frontend URLs are set
if not settings.DEBUG and not (FRONTEND_SUCCESS_URL and FRONTEND_CANCEL_URL):
    logger.warning('Frontend payment URLs not configured for production')

logger.info(f"Stripe payment URLs configured - Success: {FRONTEND_SUCCESS_URL}, Cancel: {FRONTEND_CANCEL_URL}")


class CreatePaymentSessionView(APIView):
    """
    POST /api/payments/create-session/
    
    Create Stripe Checkout Session for a booking
    - Validates booking exists and can be paid
    - Creates Payment record (status: PENDING)
    - Creates Stripe Checkout Session
    - Returns session URL for frontend redirect
    """
    permission_classes = [IsAuthenticated, CanAccessPayments]
    
    def post(self, request):
        """Create Stripe payment session"""
        # Validate Stripe keys are configured
        if not STRIPE_SECRET_KEY or not STRIPE_WEBHOOK_SECRET:
            logger.error(f'Stripe configuration missing. Secret: {bool(STRIPE_SECRET_KEY)}, Webhook: {bool(STRIPE_WEBHOOK_SECRET)}')
            return Response(
                {
                    'success': False,
                    'error': 'Payment service is not properly configured. Please contact administrator.',
                    'details': {
                        'stripe_configured': bool(STRIPE_SECRET_KEY),
                        'webhook_configured': bool(STRIPE_WEBHOOK_SECRET)
                    }
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )
        
        serializer = CreatePaymentSessionSerializer(data=request.data)
        
        if not serializer.is_valid():
            logger.warning(f"Invalid session creation request: {serializer.errors}")
            return get_safe_error_response(
                'Invalid request parameters',
                status.HTTP_400_BAD_REQUEST
            )
        
        booking = serializer.validated_data['booking']
        
        # Verify user is the booking owner or is staff
        if booking.user != request.user and not request.user.is_staff:
            logger.warning(f"Unauthorized payment attempt for booking {booking.id}")
            return Response(
                {'success': False, 'error': 'You do not own this booking'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        try:
            with transaction.atomic():
                # Delete any failed Payment record for this booking
                from hotels.models import Payment
                Payment.objects.filter(booking=booking, status='FAILED').delete()
                # Always create a new Payment record for each booking if payment is not already processing or succeeded
                payment, created = Payment.objects.get_or_create(
                    booking=booking,
                    defaults={
                        'amount': booking.total_price,
                        'currency': STRIPE_CURRENCY_PRIMARY,
                        'status': 'PENDING',
                    }
                )
                # Prevent creating multiple sessions for same booking
                if not created and payment.status in ['PROCESSING', 'SUCCEEDED']:
                    logger.warning(f"Attempt to create session for already paid booking {booking.id}")
                    return Response(
                        {'success': False, 'error': 'Payment already initiated or completed'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                currency = STRIPE_CURRENCY_PRIMARY
                amount_cents = int(float(booking.total_price) * 100)
                session_kwargs = dict(
                    mode='payment',
                    payment_method_types=['card'],
                    line_items=[{
                        'price_data': {
                            'currency': currency,
                            'product_data': {
                                'name': f'Booking at {booking.hotel.name}',
                                'description': (
                                    f'{booking.room_type.get_type_display()} room - '
                                    f'{booking.number_of_nights} nights'
                                ),
                            },
                            'unit_amount': amount_cents,
                        },
                        'quantity': 1,
                    }],
                    payment_intent_data={
                        'metadata': {
                            'booking_id': str(booking.id),
                            'user_id': str(booking.user.id),
                            'hotel_id': str(booking.hotel.id),
                        },
                    },
                    metadata={
                        'booking_id': str(booking.id),
                        'payment_id': str(payment.id),
                    },
                    success_url=f'{FRONTEND_SUCCESS_URL}?session_id={{CHECKOUT_SESSION_ID}}&booking_id={booking.id}',
                    cancel_url=f'{FRONTEND_CANCEL_URL}?booking_id={booking.id}',
                )
                try:
                    session = stripe.checkout.Session.create(**session_kwargs)
                except stripe.error.InvalidRequestError as e:
                    logger.warning(
                        f"Stripe currency {currency} not supported, "
                        f"falling back to {STRIPE_CURRENCY_FALLBACK}: {str(e)}"
                    )
                    currency = STRIPE_CURRENCY_FALLBACK
                    payment.currency = currency
                    session_kwargs['line_items'][0]['price_data']['currency'] = currency
                    session = stripe.checkout.Session.create(**session_kwargs)
                # Always update with new intent and session
                payment.stripe_payment_intent = session.payment_intent or ''
                payment.stripe_session_id = session.id
                payment.status = 'PROCESSING'
                try:
                    payment.save()
                except Exception as save_error:
                    # Handle duplicate intent gracefully
                    logger.error(f"Payment save failed: {save_error}")
                    return Response(
                        {'success': False, 'error': 'Payment session creation failed due to duplicate intent. Please try again.'},
                        status=status.HTTP_500_INTERNAL_SERVER_ERROR
                    )
                logger.info(
                    f"Payment session created - Booking: {booking.id}, "
                    f"Session: {session.id}, URL: {session.url}, "
                    f"Amount: {booking.total_price} {currency}"
                )
                return Response({
                    'success': True,
                    'message': 'Payment session created',
                    'session_id': session.id,
                    'session_url': session.url,
                    'payment_id': payment.id,
                    'publishable_key': STRIPE_PUBLISHABLE_KEY,
                }, status=status.HTTP_201_CREATED)
        
        except stripe.error.StripeError as e:
            logger.error(f"Stripe error creating session: {str(e)}")
            error_message = str(e)
            
            # Provide specific error guidance based on error type
            if 'No such plan' in error_message or 'Invalid' in error_message:
                user_message = f'Payment configuration error: {error_message}. Please contact support.'
            elif 'rate limit' in error_message.lower():
                user_message = 'Too many payment requests. Please wait a moment and try again.'
            elif 'api_key' in error_message.lower() or 'authentication' in error_message.lower():
                user_message = 'Payment service authentication failed. Please try again later.'
            else:
                user_message = f'Payment error: {error_message}'
            
            return Response(
                {
                    'success': False,
                    'error': user_message
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            logger.error(f"Unexpected error creating payment session: {str(e)}", exc_info=True)
            return Response(
                {
                    'success': False,
                    'error': f'Unexpected payment error: {str(e)}'
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class StripeWebhookView(APIView):
    """
    POST /api/payments/webhook/
    
    Handle Stripe webhook events
    - Verifies Stripe signature with webhook secret
    - Updates booking status on successful payment
    - Creates/updates Payment record
    
    Security:
    - Requires valid Stripe signature verification
    - Does not reveal internal error details
    """
    permission_classes = [AllowAny]
    
    @csrf_exempt
    def post(self, request):
        """Handle Stripe webhook"""
        # Validate webhook secret is configured
        if not STRIPE_WEBHOOK_SECRET:
            logger.error('Stripe webhook secret not configured')
            return Response(
                {'error': 'Webhook not configured'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )
        
        payload = request.body
        sig_header = request.META.get('HTTP_STRIPE_SIGNATURE')
        
        # Verify signature is provided
        if not sig_header:
            logger.warning('Webhook request missing Stripe signature')
            return Response(
                {'error': 'Invalid request'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        try:
            # Verify webhook signature - this is critical for security
            event = stripe.Webhook.construct_event(
                payload, sig_header, STRIPE_WEBHOOK_SECRET
            )
        except ValueError as e:
            logger.warning(f"Invalid webhook payload: {str(e)}")
            return get_safe_error_response(
                'Invalid webhook data',
                status.HTTP_400_BAD_REQUEST
            )
        except stripe.error.SignatureVerificationError as e:
            logger.warning(f"Invalid webhook signature from IP: {request.META.get('REMOTE_ADDR')}")
            return get_safe_error_response(
                'Invalid webhook signature',
                status.HTTP_403_FORBIDDEN
            )
        
        try:
            # Handle checkout.session.completed event
            if event['type'] == 'checkout.session.completed':
                session = event['data']['object']
                handle_checkout_session_completed(session)
            
            # Handle payment_intent.succeeded event
            elif event['type'] == 'payment_intent.succeeded':
                payment_intent = event['data']['object']
                handle_payment_intent_succeeded(payment_intent)
            
            # Handle payment_intent.payment_failed event
            elif event['type'] == 'payment_intent.payment_failed':
                payment_intent = event['data']['object']
                handle_payment_intent_failed(payment_intent)
            
            # Handle charge.refunded event
            elif event['type'] == 'charge.refunded':
                charge = event['data']['object']
                handle_charge_refunded(charge)
            
            logger.info(f"Webhook processed successfully: {event['type']}")
            return Response({'status': 'success'}, status=status.HTTP_200_OK)
        
        except Exception as e:
            logger.error(f"Error processing webhook: {str(e)}")
            return Response(
                {'error': 'Webhook processing error'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


def handle_checkout_session_completed(session):
    """Handle checkout.session.completed event"""
    booking_id = session['metadata'].get('booking_id')
    payment_id = session['metadata'].get('payment_id')
    
    if not booking_id:
        logger.warning("Webhook received without booking_id metadata")
        return
    
    try:
        booking = Booking.objects.get(id=booking_id)
        
        # Update booking status to PAID
        booking.status = 'PAID'
        booking.save()
        
        # Update payment record
        payment = Payment.objects.get(id=payment_id)
        payment.status = 'SUCCEEDED'
        payment.save()
        
        logger.info(
            f"Booking {booking_id} marked as PAID via webhook - "
            f"Session: {session['id']}"
        )
    
    except Booking.DoesNotExist:
        logger.error(f"Booking {booking_id} not found for webhook")
    except Payment.DoesNotExist:
        logger.error(f"Payment {payment_id} not found for webhook")
    except Exception as e:
        logger.error(f"Error handling checkout session: {str(e)}")


def handle_payment_intent_succeeded(payment_intent):
    """Handle payment_intent.succeeded event"""
    booking_id = payment_intent['metadata'].get('booking_id')
    
    if not booking_id:
        logger.warning("Payment intent webhook without booking_id")
        return
    
    try:
        booking = Booking.objects.get(id=booking_id)
        
        # Only update if not already paid (prevent double-payment)
        if booking.status != 'PAID':
            booking.status = 'PAID'
            booking.save()
            
            try:
                payment = booking.payment
                payment.status = 'SUCCEEDED'
                payment.stripe_payment_intent = payment_intent['id']
                # Check for existing Payment with this stripe_payment_intent
                if payment.stripe_payment_intent:
                    existing = Payment.objects.filter(stripe_payment_intent=payment.stripe_payment_intent).exclude(pk=payment.pk).first()
                    if existing:
                        logger.error(f"Duplicate stripe_payment_intent detected: {payment.stripe_payment_intent}")
                        return Response(
                            {'success': False, 'error': 'Duplicate payment intent. Please refresh and try again.'},
                            status=status.HTTP_400_BAD_REQUEST
                        )
                payment.save()
            except Payment.DoesNotExist:
                logger.warning(f"Payment record not found for booking {booking_id}")
            
            logger.info(f"Booking {booking_id} marked as PAID (payment_intent.succeeded)")
    
    except Booking.DoesNotExist:
        logger.error(f"Booking {booking_id} not found in webhook")
    except Exception as e:
        logger.error(f"Error handling payment intent: {str(e)}")


def handle_payment_intent_failed(payment_intent):
    """Handle payment_intent.payment_failed event"""
    booking_id = payment_intent['metadata'].get('booking_id')
    
    if not booking_id:
        return
    
    try:
        payment = Payment.objects.get(booking_id=booking_id)
        payment.status = 'FAILED'
        payment.error_message = payment_intent.get('last_payment_error', {}).get('message', 'Payment failed')
        payment.save()
        
        logger.warning(f"Payment failed for booking {booking_id}: {payment.error_message}")
    except Payment.DoesNotExist:
        logger.warning(f"Payment record not found for failed booking {booking_id}")
    except Exception as e:
        logger.error(f"Error handling failed payment intent: {str(e)}")


def handle_charge_refunded(charge):
    """Handle charge.refunded event"""
    payment_intent_id = charge.get('payment_intent')
    
    if not payment_intent_id:
        return
    
    try:
        payment = Payment.objects.get(stripe_payment_intent=payment_intent_id)
        payment.status = 'REFUNDED'
        payment.save()
        
        # Update booking status back to PENDING
        booking = payment.booking
        if booking.status == 'PAID':
            booking.status = 'PENDING'
            booking.save()
        
        logger.info(f"Payment {payment.id} refunded for booking {booking.id}")
    except Payment.DoesNotExist:
        logger.warning(f"Payment not found for refund: {payment_intent_id}")
    except Exception as e:
        logger.error(f"Error handling refund: {str(e)}")


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_booking_payment_status(request, booking_id):
    """
    GET /api/payments/booking/{booking_id}/status/
    
    Get payment status for a booking
    """
    try:
        booking = Booking.objects.get(id=booking_id)
        
        # Verify user is booking owner or staff
        if booking.user != request.user and not request.user.is_staff:
            return Response(
                {'error': 'You do not have permission to view this booking'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        serializer = BookingPaymentStatusSerializer(booking)
        return Response({
            'success': True,
            'data': serializer.data
        })
    
    except Booking.DoesNotExist:
        return Response(
            {'success': False, 'error': 'Booking not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        logger.error(f"Error getting payment status: {str(e)}")
        return Response(
            {'success': False, 'error': 'Error retrieving payment status'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


# ─────────────────────────────────────────────────────────────
#  SIMULATION MODE  — Works without Stripe keys
# ─────────────────────────────────────────────────────────────

class SimulatedPaymentView(APIView):
    """
    POST /api/payments/simulate/
    
    Simulates a payment flow for MVP / development.
    Supports:
      - Credit/Debit Card (simulated validation)
      - Cash on Arrival
    
    Request Body:
    {
        "booking_id": 123,
        "payment_method": "card",   // "card" or "cash_on_arrival"
        "card_number": "4242424242424242",  // only for card
        "card_expiry": "12/28",            // only for card
        "card_cvv": "123",                 // only for card
        "card_holder": "John Doe"          // only for card
    }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        booking_id = request.data.get('booking_id')
        payment_method = request.data.get('payment_method', 'card')

        if not booking_id:
            return Response(
                {'success': False, 'error': 'booking_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            booking = Booking.objects.select_related('hotel', 'room_type', 'user').get(id=booking_id)
        except Booking.DoesNotExist:
            return Response(
                {'success': False, 'error': 'Booking not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Verify ownership
        if booking.user != request.user and not request.user.is_staff:
            return Response(
                {'success': False, 'error': 'Access denied'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Already paid?
        if booking.status == 'PAID':
            return Response(
                {'success': False, 'error': 'Booking is already paid'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if booking.status == 'CANCELLED':
            return Response(
                {'success': False, 'error': 'Cannot pay for a cancelled booking'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # ── PRE-PAYMENT VALIDATION ──────────────────────────

        # 1. Room still available?
        if booking.room_type:
            avail = booking.room_type.get_available_rooms(booking.check_in, booking.check_out)
            if avail < booking.rooms_booked:
                return Response({
                    'success': False,
                    'error': f'Room no longer available. Only {avail} left.',
                    'validation_error': 'room_unavailable'
                }, status=status.HTTP_409_CONFLICT)

        # 2. Price unchanged check — recalculate
        if booking.room_type and booking.check_in and booking.check_out:
            from decimal import Decimal, ROUND_HALF_UP
            from hotels.models import GST_RATE, SERVICE_CHARGE_RATE
            nights = max(1, (booking.check_out - booking.check_in).days)
            expected_base = (booking.room_type.price_per_night * nights * booking.rooms_booked)
            expected_base = expected_base.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            if booking.base_price and booking.base_price != expected_base:
                # Price has changed — update and notify
                old_total = float(booking.total_price or 0)
                booking.calculate_price_breakdown()
                booking.save()
                return Response({
                    'success': False,
                    'error': 'Price has been updated since booking was created.',
                    'validation_error': 'price_changed',
                    'old_total': old_total,
                    'new_total': float(booking.total_price),
                    'price_breakdown': booking.price_breakdown,
                }, status=status.HTTP_409_CONFLICT)

        # 3. Dates still valid?
        from django.utils import timezone as tz
        if booking.check_in and booking.check_in < tz.now().date():
            return Response({
                'success': False,
                'error': 'Check-in date is in the past',
                'validation_error': 'dates_invalid'
            }, status=status.HTTP_400_BAD_REQUEST)

        # 4. Adults match occupancy?
        if booking.room_type and booking.adults:
            if booking.adults > (booking.room_type.max_occupancy * booking.rooms_booked):
                return Response({
                    'success': False,
                    'error': f'Total adults ({booking.adults}) exceeds maximum occupancy for {booking.rooms_booked} room(s).',
                    'validation_error': 'occupancy_exceeded',
                    'max_occupancy': booking.room_type.max_occupancy * booking.rooms_booked
                }, status=status.HTTP_400_BAD_REQUEST)

        # ── PROCESS PAYMENT ─────────────────────────────────

        if payment_method == 'card':
            # Simulated card validation
            card_number = str(request.data.get('card_number', '')).replace(' ', '').replace('-', '')
            card_expiry = request.data.get('card_expiry', '')
            card_cvv = request.data.get('card_cvv', '')
            card_holder = request.data.get('card_holder', '')

            errors = []
            if not card_number or len(card_number) < 13 or len(card_number) > 19:
                errors.append('Invalid card number')
            if not card_expiry or '/' not in card_expiry:
                errors.append('Invalid expiry date (use MM/YY)')
            if not card_cvv or len(card_cvv) < 3 or len(card_cvv) > 4:
                errors.append('Invalid CVV')
            if not card_holder or len(card_holder) < 2:
                errors.append('Card holder name is required')

            if errors:
                return Response(
                    {'success': False, 'error': '; '.join(errors), 'validation_errors': errors},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Determine card brand
            brand = 'Unknown'
            if card_number.startswith('4'):
                brand = 'Visa'
            elif card_number[:2] in ('51', '52', '53', '54', '55'):
                brand = 'Mastercard'
            elif card_number[:2] in ('34', '37'):
                brand = 'Amex'

            # Simulate successful payment
            with transaction.atomic():
                booking.status = 'PAID'
                booking.payment_method = 'ONLINE'
                if not booking.base_price:
                    booking.calculate_price_breakdown()
                booking.save()

                # Create Payment record
                payment, _ = Payment.objects.update_or_create(
                    booking=booking,
                    defaults={
                        'amount': booking.total_price,
                        'currency': 'PKR',
                        'status': 'SUCCEEDED',
                        'payment_method_type': 'card',
                        'last4': card_number[-4:],
                        'brand': brand,
                        'stripe_payment_intent': f'sim_pi_{booking.booking_reference}',
                        'metadata': {
                            'simulated': True,
                            'card_holder': card_holder,
                            'card_brand': brand,
                        }
                    }
                )

            logger.info(f"Simulated card payment for booking {booking.id} ({booking.booking_reference})")

            return Response({
                'success': True,
                'message': 'Payment successful (simulation mode)',
                'booking_id': booking.id,
                'booking_reference': booking.booking_reference,
                'invoice_number': booking.invoice_number,
                'payment_method': 'card',
                'card_brand': brand,
                'card_last4': card_number[-4:],
                'price_breakdown': booking.price_breakdown,
                'status': 'PAID'
            })

        elif payment_method == 'cash_on_arrival':
            with transaction.atomic():
                booking.status = 'CONFIRMED'
                booking.payment_method = 'ARRIVAL'
                if not booking.base_price:
                    booking.calculate_price_breakdown()
                booking.save()

            logger.info(f"Cash on arrival confirmed for booking {booking.id} ({booking.booking_reference})")

            return Response({
                'success': True,
                'message': 'Booking confirmed. Pay at the hotel upon arrival.',
                'booking_id': booking.id,
                'booking_reference': booking.booking_reference,
                'payment_method': 'cash_on_arrival',
                'price_breakdown': booking.price_breakdown,
                'status': 'CONFIRMED'
            })

        else:
            return Response(
                {'success': False, 'error': f'Unsupported payment method: {payment_method}'},
                status=status.HTTP_400_BAD_REQUEST
            )


class BookingPriceBreakdownView(APIView):
    """
    GET /api/payments/booking/{booking_id}/breakdown/
    
    Returns the price breakdown for a booking.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, booking_id):
        try:
            booking = Booking.objects.select_related('hotel', 'room_type').get(id=booking_id)
        except Booking.DoesNotExist:
            return Response({'success': False, 'error': 'Booking not found'}, status=status.HTTP_404_NOT_FOUND)

        if booking.user != request.user and not request.user.is_staff:
            return Response({'success': False, 'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)

        # Recalculate if missing
        if not booking.base_price:
            booking.calculate_price_breakdown()
            booking.save()

        return Response({
            'success': True,
            'booking_id': booking.id,
            'booking_reference': booking.booking_reference,
            'hotel_name': booking.hotel.name if booking.hotel else '',
            'room_type': booking.room_type.get_type_display() if booking.room_type else '',
            'check_in': str(booking.check_in),
            'check_out': str(booking.check_out),
            'price_breakdown': booking.price_breakdown,
        })


class BookingInvoiceView(APIView):
    """
    GET /api/payments/booking/{booking_id}/invoice/
    
    Returns a downloadable HTML invoice for a paid booking.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, booking_id):
        from django.http import HttpResponse

        try:
            booking = Booking.objects.select_related('hotel', 'room_type', 'user').get(id=booking_id)
        except Booking.DoesNotExist:
            return Response({'success': False, 'error': 'Booking not found'}, status=status.HTTP_404_NOT_FOUND)

        if booking.user != request.user and not request.user.is_staff:
            return Response({'success': False, 'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)

        if booking.status not in ('PAID', 'CONFIRMED', 'COMPLETED'):
            return Response({'success': False, 'error': 'Invoice only available for confirmed/paid bookings'}, status=status.HTTP_400_BAD_REQUEST)

        # Ensure price breakdown exists
        if not booking.base_price:
            booking.calculate_price_breakdown()
            booking.save()

        hotel_name = booking.hotel.name if booking.hotel else 'N/A'
        room_type = booking.room_type.get_type_display() if booking.room_type else 'N/A'
        guest = booking.guest_name or (booking.user.get_full_name() if booking.user else 'Guest')
        email = booking.guest_email or (booking.user.email if booking.user else '')

        html = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Invoice {booking.invoice_number or booking.booking_reference}</title>
<style>
    body {{ font-family: 'Segoe UI', Arial, sans-serif; max-width: 700px; margin: 40px auto; padding: 20px; color: #1a1a2e; }}
    .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0; }}
    .header h1 {{ margin: 0; font-size: 28px; }}
    .header p {{ margin: 5px 0 0; opacity: 0.9; }}
    .body {{ border: 1px solid #e2e8f0; border-top: none; padding: 30px; border-radius: 0 0 12px 12px; }}
    .section {{ margin-bottom: 24px; }}
    .section h3 {{ color: #667eea; margin-bottom: 8px; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; }}
    .row {{ display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f1f5f9; }}
    .row:last-child {{ border-bottom: none; }}
    .label {{ color: #64748b; }}
    .value {{ font-weight: 600; }}
    .total-row {{ background: #f8fafc; padding: 12px; border-radius: 8px; margin-top: 8px; font-size: 18px; }}
    .total-row .value {{ color: #667eea; }}
    .badge {{ background: #10b981; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }}
    .footer {{ text-align: center; margin-top: 30px; color: #94a3b8; font-size: 12px; }}
</style>
</head>
<body>
    <div class="header">
        <h1>🧳 Travello</h1>
        <p>Booking Confirmation & Invoice</p>
    </div>
    <div class="body">
        <div class="section">
            <h3>Booking Details</h3>
            <div class="row"><span class="label">Booking Reference</span><span class="value">{booking.booking_reference}</span></div>
            <div class="row"><span class="label">Invoice Number</span><span class="value">{booking.invoice_number or 'Pending'}</span></div>
            <div class="row"><span class="label">Status</span><span class="badge">{booking.status}</span></div>
        </div>
        
        <div class="section">
            <h3>Guest Information</h3>
            <div class="row"><span class="label">Guest Name</span><span class="value">{guest}</span></div>
            <div class="row"><span class="label">Email</span><span class="value">{email}</span></div>
            <div class="row"><span class="label">Phone</span><span class="value">{booking.guest_phone or 'N/A'}</span></div>
        </div>
        
        <div class="section">
            <h3>Hotel & Room</h3>
            <div class="row"><span class="label">Hotel</span><span class="value">{hotel_name}</span></div>
            <div class="row"><span class="label">Room Type</span><span class="value">{room_type}</span></div>
            <div class="row"><span class="label">Rooms</span><span class="value">{booking.rooms_booked}</span></div>
            <div class="row"><span class="label">Check-in</span><span class="value">{booking.check_in}</span></div>
            <div class="row"><span class="label">Check-out</span><span class="value">{booking.check_out}</span></div>
            <div class="row"><span class="label">Nights</span><span class="value">{booking.number_of_nights}</span></div>
        </div>
        
        <div class="section">
            <h3>Price Breakdown</h3>
            <div class="row"><span class="label">Room Rate ({booking.number_of_nights} nights × {booking.rooms_booked} room(s))</span><span class="value">PKR {booking.base_price or booking.total_price}</span></div>
            <div class="row"><span class="label">GST (16%)</span><span class="value">PKR {booking.tax_amount or 0}</span></div>
            <div class="row"><span class="label">Service Charge (5%)</span><span class="value">PKR {booking.service_charge or 0}</span></div>
            <div class="row total-row"><span class="label">Total</span><span class="value">PKR {booking.total_price}</span></div>
        </div>
        
        <div class="section">
            <h3>Payment</h3>
            <div class="row"><span class="label">Payment Method</span><span class="value">{booking.get_payment_method_display()}</span></div>
            <div class="row"><span class="label">Date</span><span class="value">{booking.updated_at.strftime('%B %d, %Y %I:%M %p') if booking.updated_at else 'N/A'}</span></div>
        </div>
    </div>
    <div class="footer">
        <p>Thank you for booking with Travello! 🌍</p>
        <p>This is a system-generated invoice. No signature required.</p>
    </div>
</body>
</html>"""

        response = HttpResponse(html, content_type='text/html')
        response['Content-Disposition'] = f'inline; filename="invoice_{booking.booking_reference}.html"'
        return response


class BookingConfirmationEmailView(APIView):
    """
    POST /api/payments/booking/{booking_id}/send-confirmation/
    
    Simulates sending a confirmation email (stores in DB metadata).
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, booking_id):
        try:
            booking = Booking.objects.select_related('hotel', 'room_type', 'user').get(id=booking_id)
        except Booking.DoesNotExist:
            return Response({'success': False, 'error': 'Booking not found'}, status=status.HTTP_404_NOT_FOUND)

        if booking.user != request.user and not request.user.is_staff:
            return Response({'success': False, 'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)

        # Simulate email
        email_data = {
            'to': booking.guest_email or booking.user.email,
            'subject': f'Booking Confirmed - {booking.booking_reference}',
            'hotel': booking.hotel.name if booking.hotel else 'N/A',
            'room': booking.room_type.get_type_display() if booking.room_type else 'N/A',
            'check_in': str(booking.check_in),
            'check_out': str(booking.check_out),
            'total': float(booking.total_price or 0),
            'status': booking.status,
            'sent_at': tz.now().isoformat() if 'tz' in dir() else __import__('django.utils.timezone', fromlist=['now']).now().isoformat(),
            'simulated': True,
        }

        # Store in booking payment metadata
        try:
            payment = booking.payment
            meta = payment.metadata or {}
            meta['confirmation_email'] = email_data
            payment.metadata = meta
            payment.save(update_fields=['metadata'])
        except Payment.DoesNotExist:
            pass  # No payment record yet

        logger.info(f"Simulated confirmation email for booking {booking.booking_reference} to {email_data['to']}")

        return Response({
            'success': True,
            'message': f'Confirmation email sent to {email_data["to"]} (simulated)',
            'email_data': email_data
        })

