import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Sphere } from '@react-three/drei';
import { useRef, Suspense, useMemo, memo } from 'react';
import { FaPlane, FaMapMarkerAlt, FaCamera, FaGlobe, FaHeart, FaHotel, FaMapMarkedAlt } from 'react-icons/fa';

// 3D Globe Component - Memoized for performance
const Globe = memo(() => {
  const meshRef = useRef();

  return (
    <Sphere ref={meshRef} args={[1, 32, 32]}>
      <meshStandardMaterial
        color="#3a7ca5"
        wireframe
        transparent
        opacity={0.7}
      />
    </Sphere>
  );
});

Globe.displayName = 'Globe';

// Particle Background Component - Memoized and optimized
const ParticleBackground = memo(() => {
  const particles = useMemo(() => 
    Array.from({ length: 30 }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      delay: `${Math.random() * 5}s`,
      className: `particle-${(i % 3) + 1}`,
    })), []
  );

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((particle) => (
        <div
          key={particle.id}
          className={`particle ${particle.className}`}
          style={{
            left: particle.left,
            top: particle.top,
            animationDelay: particle.delay,
          }}
        />
      ))}
    </div>
  );
});

ParticleBackground.displayName = 'ParticleBackground';

// Floating Navbar Component - Memoized
const FloatingNavbar = memo(() => {
  return (
    <motion.nav
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: 'easeOut' }}
      className="fixed top-0 left-0 right-0 z-50 px-4 sm:px-6 py-4"
    >
      <div className="max-w-7xl mx-auto bg-white/90 backdrop-blur-lg rounded-2xl px-4 sm:px-6 py-3 flex items-center justify-between shadow-xl border border-sky-100">
        <motion.div
          initial={{ rotate: 0 }}
          animate={{ rotate: 360 }}
          transition={{ duration: 2, ease: 'easeInOut' }}
          className="flex items-center gap-2 sm:gap-3"
        >
          <FaGlobe className="text-2xl sm:text-3xl text-sky-500" />
          <span className="text-xl sm:text-2xl font-bold text-sky-600" style={{ fontFamily: 'Poppins, sans-serif' }}>
            Travello
          </span>
        </motion.div>
        <div className="hidden md:flex gap-6 text-gray-700 font-medium">
          <a href="#features" className="hover:text-sky-600 transition-colors">Features</a>
          <a href="#about" className="hover:text-sky-600 transition-colors">About</a>
          <a href="#contact" className="hover:text-sky-600 transition-colors">Contact</a>
        </div>
      </div>
    </motion.nav>
  );
});

FloatingNavbar.displayName = 'FloatingNavbar';

// Feature Card Component - Memoized
const FeatureCard = memo(({ icon: Icon, title, description, delay, color }) => {
  const colorMap = {
    sky: 'bg-sky-500',
    blue: 'bg-blue-500',
    indigo: 'bg-indigo-500'
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay }}
      whileHover={{
        scale: 1.05,
        y: -10,
      }}
      className="bg-white rounded-3xl p-6 sm:p-8 shadow-lg hover:shadow-2xl transition-all duration-300 cursor-pointer group border border-sky-100"
    >
      <motion.div
        whileHover={{ scale: 1.2, rotate: 360 }}
        transition={{ duration: 0.5 }}
        className={`w-12 h-12 sm:w-16 sm:h-16 ${colorMap[color]} rounded-2xl flex items-center justify-center mb-4 sm:mb-6 shadow-md group-hover:shadow-xl`}
      >
        <Icon className="text-2xl sm:text-3xl text-white" />
      </motion.div>
      <h3 className="text-xl sm:text-2xl font-bold text-gray-800 mb-2 sm:mb-3" style={{ fontFamily: 'Poppins, sans-serif' }}>
        {title}
      </h3>
      <p className="text-gray-600 text-base sm:text-lg" style={{ fontFamily: 'Inter, sans-serif' }}>
        {description}
      </p>
    </motion.div>
  );
});

FeatureCard.displayName = 'FeatureCard';

// Animated Travel Icons Component - Memoized and optimized
const AnimatedTravelIcons = memo(() => {
  return (
    <div className="relative w-full h-48 sm:h-64 flex items-center justify-center">
      <motion.div
        animate={{
          y: [0, -20, 0],
          rotate: [0, 10, -10, 0],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="absolute"
        style={{ left: '10%', top: '20%' }}
      >
        <FaPlane className="text-4xl sm:text-6xl text-sky-400 drop-shadow-2xl" />
      </motion.div>
      
      <motion.div
        animate={{
          scale: [1, 1.2, 1],
          rotate: [0, 360],
        }}
        transition={{
          duration: 5,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="absolute"
      >
        <div className="w-24 h-24 sm:w-32 sm:h-32">
          <Suspense fallback={<div className="w-full h-full bg-sky-200 rounded-full animate-pulse" />}>
            <Canvas>
              <ambientLight intensity={0.5} />
              <pointLight position={[10, 10, 10]} />
              <Globe />
              <OrbitControls enableZoom={false} autoRotate autoRotateSpeed={2} />
            </Canvas>
          </Suspense>
        </div>
      </motion.div>

      <motion.div
        animate={{
          y: [0, 20, 0],
          rotate: [0, -10, 10, 0],
        }}
        transition={{
          duration: 3.5,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="absolute"
        style={{ right: '10%', top: '20%' }}
      >
        <FaCamera className="text-4xl sm:text-6xl text-amber-400 drop-shadow-2xl" />
      </motion.div>

      <motion.div
        animate={{
          y: [0, -15, 0],
          scale: [1, 1.1, 1],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="absolute"
        style={{ bottom: '10%', left: '40%' }}
      >
        <FaMapMarkerAlt className="text-3xl sm:text-5xl text-rose-400 drop-shadow-2xl" />
      </motion.div>
    </div>
  );
});

AnimatedTravelIcons.displayName = 'AnimatedTravelIcons';

const Landing = () => {
  const navigate = useNavigate();

  const handleGetStarted = () => {
    navigate('/login');
  };

  const handleAdminLogin = () => {
    navigate('/admin-login');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-sky-50 to-blue-100 relative overflow-hidden">
      <ParticleBackground />

      <FloatingNavbar />

      <div className="relative z-10 pt-24 sm:pt-32 pb-12 sm:pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1 }}
            className="text-center mb-12 sm:mb-16"
          >
            <AnimatedTravelIcons />

            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black mb-4 sm:mb-6 bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-600 bg-clip-text text-transparent"
              style={{ fontFamily: 'Poppins, sans-serif' }}
            >
              Travello
            </motion.h1>

            <motion.h2
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.5 }}
              className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-gray-800 mb-4 sm:mb-6 drop-shadow-sm px-4"
              style={{ fontFamily: 'Poppins, sans-serif' }}
            >
              Explore the World with Travello
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.7 }}
              className="text-lg sm:text-xl md:text-2xl text-gray-600 max-w-3xl mx-auto leading-relaxed mb-8 sm:mb-12 px-4"
              style={{ fontFamily: 'Inter, sans-serif' }}
            >
              Discover amazing destinations, plan your perfect trip, and create unforgettable memories. 
              Your journey starts here.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.9 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 px-4"
            >
              <motion.button
                onClick={handleGetStarted}
                whileHover={{
                  scale: 1.05,
                  y: -5,
                }}
                whileTap={{ scale: 0.95 }}
                className="w-full sm:w-auto bg-gradient-to-r from-sky-500 to-blue-600 text-white font-bold py-4 sm:py-5 px-10 sm:px-12 rounded-2xl text-lg sm:text-xl shadow-2xl hover:from-sky-600 hover:to-blue-700 flex items-center justify-center gap-3 group btn-touch"
                style={{ fontFamily: 'Poppins, sans-serif' }}
              >
                <FaPlane className="text-xl sm:text-2xl group-hover:rotate-12 transition-transform" />
                Get Started
              </motion.button>

              <motion.button
                onClick={handleAdminLogin}
                whileHover={{
                  scale: 1.05,
                  y: -5,
                }}
                whileTap={{ scale: 0.95 }}
                className="w-full sm:w-auto bg-white text-sky-600 font-bold py-4 sm:py-5 px-10 sm:px-12 rounded-2xl text-lg sm:text-xl shadow-xl border-2 border-sky-200 hover:border-sky-400 hover:bg-sky-50 flex items-center justify-center gap-3 btn-touch"
                style={{ fontFamily: 'Poppins, sans-serif' }}
              >
                <FaGlobe className="text-xl sm:text-2xl" />
                Admin Login
              </motion.button>
            </motion.div>
          </motion.div>
        </div>
      </div>

      <div id="features" className="py-12 sm:py-20 px-4 bg-white">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12 sm:mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-black mb-4 bg-gradient-to-r from-sky-600 to-blue-600 bg-clip-text text-transparent" style={{ fontFamily: 'Poppins, sans-serif' }}>
              Everything You Need
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto" style={{ fontFamily: 'Inter, sans-serif' }}>
              Discover amazing features designed to make your travel planning effortless
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8 mb-20">
            <FeatureCard
              icon={FaHotel}
              title="Best Hotels"
              description="Find and book the perfect accommodations for your journey"
              delay={0.2}
              color="sky"
            />
            <FeatureCard
              icon={FaPlane}
              title="Flight Deals"
              description="Get exclusive discounts on flights worldwide"
              delay={0.4}
              color="blue"
            />
            <FeatureCard
              icon={FaMapMarkedAlt}
              title="Travel Guides"
              description="Expert recommendations for every destination"
              delay={0.6}
              color="indigo"
            />
          </div>

          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="mt-32 bg-gradient-to-r from-sky-50 to-blue-50 rounded-3xl p-12 border border-sky-200"
          >
            <div className="grid md:grid-cols-3 gap-8 text-center">
              <div>
                <motion.h3
                  initial={{ scale: 0 }}
                  whileInView={{ scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  className="text-6xl font-black bg-gradient-to-r from-sky-600 to-blue-600 bg-clip-text text-transparent mb-3"
                  style={{ fontFamily: 'Poppins, sans-serif' }}
                >
                  10K+
                </motion.h3>
                <p className="text-xl text-gray-700 font-medium" style={{ fontFamily: 'Inter, sans-serif' }}>
                  Destinations
                </p>
              </div>
              <div>
                <motion.h3
                  initial={{ scale: 0 }}
                  whileInView={{ scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.4 }}
                  className="text-6xl font-black bg-gradient-to-r from-sky-600 to-blue-600 bg-clip-text text-transparent mb-3"
                  style={{ fontFamily: 'Poppins, sans-serif' }}
                >
                  50K+
                </motion.h3>
                <p className="text-xl text-gray-700 font-medium" style={{ fontFamily: 'Inter, sans-serif' }}>
                  Happy Travelers
                </p>
              </div>
              <div>
                <motion.h3
                  initial={{ scale: 0 }}
                  whileInView={{ scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.6 }}
                  className="text-6xl font-black bg-gradient-to-r from-sky-600 to-blue-600 bg-clip-text text-transparent mb-3"
                  style={{ fontFamily: 'Poppins, sans-serif' }}
                >
                  100K+
                </motion.h3>
                <p className="text-xl text-gray-700 font-medium" style={{ fontFamily: 'Inter, sans-serif' }}>
                  Trips Planned
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      <motion.footer
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8 }}
        className="relative z-10 bg-gradient-to-b from-sky-50 to-white mt-20 py-12 border-t border-sky-200"
        id="contact"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <FaGlobe className="text-3xl text-sky-500" />
                <h3 className="text-2xl font-bold text-gray-800" style={{ fontFamily: 'Poppins, sans-serif' }}>
                  Travello
                </h3>
              </div>
              <p className="text-gray-600" style={{ fontFamily: 'Inter, sans-serif' }}>
                Your ultimate travel companion for exploring the world
              </p>
            </div>
            <div>
              <h4 className="text-xl font-bold text-gray-800 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>
                Quick Links
              </h4>
              <ul className="space-y-2 text-gray-600" style={{ fontFamily: 'Inter, sans-serif' }}>
                <li><a href="#about" className="hover:text-sky-600 transition-colors">About Us</a></li>
                <li><a href="#features" className="hover:text-sky-600 transition-colors">Features</a></li>
                <li><a href="#contact" className="hover:text-sky-600 transition-colors">Contact</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-xl font-bold text-gray-800 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>
                Legal
              </h4>
              <ul className="space-y-2 text-gray-600" style={{ fontFamily: 'Inter, sans-serif' }}>
                <li><a href="#privacy" className="hover:text-sky-600 transition-colors">Privacy Policy</a></li>
                <li><a href="#terms" className="hover:text-sky-600 transition-colors">Terms of Service</a></li>
                <li><a href="#cookies" className="hover:text-sky-600 transition-colors">Cookie Policy</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-xl font-bold text-gray-800 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>
                Connect
              </h4>
              <div className="flex gap-4">
                <motion.a
                  whileHover={{ scale: 1.2, rotate: 360 }}
                  href="#"
                  className="w-10 h-10 bg-sky-500 rounded-full flex items-center justify-center text-white hover:bg-sky-600 shadow-lg"
                >
                  <FaGlobe />
                </motion.a>
                <motion.a
                  whileHover={{ scale: 1.2, rotate: 360 }}
                  href="#"
                  className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white hover:bg-blue-600 shadow-lg"
                >
                  <FaHeart />
                </motion.a>
                <motion.a
                  whileHover={{ scale: 1.2, rotate: 360 }}
                  href="#"
                  className="w-10 h-10 bg-indigo-500 rounded-full flex items-center justify-center text-white hover:bg-indigo-600 shadow-lg"
                >
                  <FaCamera />
                </motion.a>
              </div>
            </div>
          </div>
          <div className="border-t border-sky-200 pt-8 text-center text-gray-600" style={{ fontFamily: 'Inter, sans-serif' }}>
            <p>&copy; 2025 Travello. All rights reserved. Made with ❤️ for travelers worldwide.</p>
          </div>
        </div>
      </motion.footer>
    </div>
  );
};

export default Landing;
