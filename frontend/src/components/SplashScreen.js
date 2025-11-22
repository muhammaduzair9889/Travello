import { motion, AnimatePresence } from 'framer-motion';
import { FaGlobe, FaPlane, FaMapMarkerAlt, FaHotel } from 'react-icons/fa';
import { useState, useEffect } from 'react';

const SplashScreen = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);
  const [currentPhase, setCurrentPhase] = useState(0);

  useEffect(() => {
    // Progress bar animation
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + 1;
      });
    }, 100); // 100ms * 100 = 10 seconds

    // Phase changes for text animation
    const phaseInterval = setInterval(() => {
      setCurrentPhase((prev) => (prev + 1) % 3);
    }, 3000); // Change phase every 3 seconds

    // Complete after 10 seconds
    const completeTimer = setTimeout(() => {
      onComplete();
    }, 10000);

    return () => {
      clearInterval(progressInterval);
      clearInterval(phaseInterval);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  const phases = [
    'Preparing your journey...',
    'Loading destinations...',
    'Almost ready...'
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.2 }}
      transition={{ duration: 0.8 }}
      className="fixed inset-0 z-[9999] bg-gradient-to-br from-white via-gray-50 to-gray-100 dark:from-gray-900 dark:via-gray-800 dark:to-black flex items-center justify-center overflow-hidden"
    >
      {/* Animated Background Particles */}
      <div className="absolute inset-0">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 bg-sky-500 dark:bg-sky-400 rounded-full opacity-20"
            initial={{
              x: `${Math.random() * 100}%`,
              y: `${Math.random() * 100}%`,
            }}
            animate={{
              x: `${Math.random() * 100}%`,
              y: `${Math.random() * 100}%`,
              scale: [1, 1.5, 1],
              opacity: [0.2, 0.4, 0.2],
            }}
            transition={{
              duration: 5 + Math.random() * 5,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>

      {/* Main Content */}
      <div className="relative z-10 text-center px-4">
        {/* Animated Globe Icon */}
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ 
            duration: 1, 
            ease: 'easeOut',
            type: 'spring',
            stiffness: 100
          }}
          className="mb-8 flex justify-center"
        >
          <motion.div
            animate={{ 
              rotate: 360,
              scale: [1, 1.1, 1]
            }}
            transition={{ 
              rotate: {
                duration: 4,
                repeat: Infinity,
                ease: 'linear'
              },
              scale: {
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut'
              }
            }}
            className="relative"
          >
            <div className="w-32 h-32 bg-gradient-to-br from-sky-400 to-blue-600 rounded-full flex items-center justify-center backdrop-blur-lg border-4 border-sky-200 dark:border-sky-700 shadow-2xl">
              <FaGlobe className="text-7xl text-white" />
            </div>
            
            {/* Orbiting Icons */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
              className="absolute inset-0"
            >
              <FaPlane className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-4 text-3xl text-sky-600 dark:text-sky-400" />
            </motion.div>
            
            <motion.div
              animate={{ rotate: -360 }}
              transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
              className="absolute inset-0"
            >
              <FaHotel className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-4 text-3xl text-blue-600 dark:text-blue-400" />
            </motion.div>
            
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 5, repeat: Infinity, ease: 'linear' }}
              className="absolute inset-0"
            >
              <FaMapMarkerAlt className="absolute top-1/2 right-0 translate-x-4 -translate-y-1/2 text-3xl text-rose-500 dark:text-rose-400" />
            </motion.div>
          </motion.div>
        </motion.div>

        {/* Brand Name with Stagger Animation */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="mb-6"
        >
          <h1 className="text-7xl md:text-8xl font-black text-gray-800 dark:text-white mb-2" style={{ fontFamily: 'Poppins, sans-serif' }}>
            {'Travello'.split('').map((char, index) => (
              <motion.span
                key={index}
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.5,
                  delay: 0.5 + index * 0.1,
                  type: 'spring',
                  stiffness: 100
                }}
                className="inline-block"
              >
                {char}
              </motion.span>
            ))}
          </h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 1.5 }}
            className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 font-medium"
            style={{ fontFamily: 'Inter, sans-serif' }}
          >
            Your Journey Begins Here
          </motion.p>
        </motion.div>

        {/* Phase Text with Fade Animation */}
        <AnimatePresence mode="wait">
          <motion.p
            key={currentPhase}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
            className="text-lg text-gray-600 dark:text-gray-400 mb-8 h-8"
            style={{ fontFamily: 'Inter, sans-serif' }}
          >
            {phases[currentPhase]}
          </motion.p>
        </AnimatePresence>

        {/* Progress Bar */}
        <div className="max-w-md mx-auto mb-3">
          <div className="relative h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden backdrop-blur-sm">
            <motion.div
              initial={{ width: '0%' }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.1 }}
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-sky-500 via-blue-600 to-sky-500 rounded-full shadow-lg"
            >
              <motion.div
                animate={{ x: ['0%', '100%'] }}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                  ease: 'linear'
                }}
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent"
              />
            </motion.div>
          </div>
          
          {/* Progress Percentage */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-gray-700 dark:text-gray-300 text-base font-semibold mt-3"
            style={{ fontFamily: 'Inter, sans-serif' }}
          >
            {progress}%
          </motion.p>
        </div>

        {/* Pulsing Dots */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="flex justify-center gap-2 mt-4 mb-8"
        >
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              animate={{
                scale: [1, 1.5, 1],
                opacity: [0.5, 1, 0.5],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                delay: i * 0.3,
              }}
              className="w-2 h-2 bg-sky-600 dark:bg-sky-400 rounded-full"
            />
          ))}
        </motion.div>

        {/* Bottom Decorative Elements - Moved below dots with more spacing */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 2 }}
          className="text-gray-500 dark:text-gray-400 text-sm mt-4"
          style={{ fontFamily: 'Inter, sans-serif' }}
        >
          <motion.p
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            Powered by Travello
          </motion.p>
        </motion.div>
      </div>

      {/* Corner Glow Effects */}
      <motion.div
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.1, 0.2, 0.1],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="absolute top-0 right-0 w-96 h-96 bg-sky-400/20 dark:bg-sky-600/20 rounded-full blur-3xl"
      />
      <motion.div
        animate={{
          scale: [1.2, 1, 1.2],
          opacity: [0.1, 0.2, 0.1],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: 2,
        }}
        className="absolute bottom-0 left-0 w-96 h-96 bg-blue-400/20 dark:bg-blue-600/20 rounded-full blur-3xl"
      />
    </motion.div>
  );
};

export default SplashScreen;
