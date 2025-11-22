import { motion } from 'framer-motion';
import { useTheme } from '../contexts/ThemeContext';
import { FaSun, FaMoon } from 'react-icons/fa';
import { useLocation } from 'react-router-dom';

const ThemeToggle = () => {
  const { toggleTheme, isDark } = useTheme();
  const location = useLocation();
  
  // Adjust position for admin pages to avoid overlapping with sign out button
  const isAdminPage = location.pathname.includes('/admin');
  const topPosition = isAdminPage ? 'top-20' : 'top-4';

  return (
    <motion.button
      onClick={toggleTheme}
      initial={{ scale: 0, rotate: -180 }}
      animate={{ scale: 1, rotate: 0 }}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      className={`fixed ${topPosition} right-4 z-40 w-12 h-12 md:w-14 md:h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 group`}
      style={{
        background: isDark
          ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
          : 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
        backdropFilter: 'blur(10px)',
        border: '2px solid rgba(255, 255, 255, 0.2)',
      }}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
    >
      <motion.div
        initial={false}
        animate={{ rotate: isDark ? 360 : 0 }}
        transition={{ duration: 0.5, ease: 'easeInOut' }}
      >
        {isDark ? (
          <FaMoon className="text-white text-xl md:text-2xl drop-shadow-lg" />
        ) : (
          <FaSun className="text-white text-xl md:text-2xl drop-shadow-lg" />
        )}
      </motion.div>

      {/* Tooltip */}
      <div className="absolute -bottom-12 right-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
        <div className="bg-gray-800 dark:bg-gray-700 text-white text-xs px-3 py-1.5 rounded-lg shadow-lg whitespace-nowrap">
          {isDark ? 'Light Mode' : 'Dark Mode'}
          <div className="absolute -top-1 right-4 w-2 h-2 bg-gray-800 dark:bg-gray-700 transform rotate-45"></div>
        </div>
      </div>
    </motion.button>
  );
};

export default ThemeToggle;