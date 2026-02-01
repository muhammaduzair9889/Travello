import { motion } from 'framer-motion';
import { useTheme } from '../contexts/ThemeContext';
import { FaSun, FaMoon } from 'react-icons/fa';
import { useLocation } from 'react-router-dom';

const ThemeToggle = () => {
  const { toggleTheme, isDark } = useTheme();
  const location = useLocation();
  
  // Adjust position for admin pages and dashboard
  const isAdminPage = location.pathname.includes('/admin');
  const isDashboard = location.pathname.includes('/dashboard');
  const topPosition = isAdminPage ? 'top-20' : isDashboard ? 'top-[18px]' : 'top-4';
  // Move to the left on dashboard (after notification bell, before sign out)
  const rightPosition = isDashboard ? 'right-[180px]' : 'right-4';

  return (
    <motion.button
      onClick={toggleTheme}
      initial={{ scale: 0, rotate: -180 }}
      animate={{ scale: 1, rotate: 0 }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className={`fixed ${topPosition} ${rightPosition} z-40 w-10 h-10 rounded-xl shadow-md flex items-center justify-center transition-all duration-300 group border-2 border-white/20`}
      style={{
        background: isDark
          ? 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)'
          : 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
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
          <FaMoon className="text-white text-lg drop-shadow-md" />
        ) : (
          <FaSun className="text-white text-lg drop-shadow-md" />
        )}
      </motion.div>

      {/* Tooltip */}
      <div className="absolute -bottom-10 right-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
        <div className="bg-gray-900 dark:bg-gray-700 text-white text-xs px-2.5 py-1.5 rounded-lg shadow-lg whitespace-nowrap">
          {isDark ? 'Light Mode' : 'Dark Mode'}
        </div>
      </div>
    </motion.button>
  );
};

export default ThemeToggle;