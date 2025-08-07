import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUpIcon, TrendingDownIcon } from '@heroicons/react/24/outline';

const MetricsCard = ({ title, value, change, icon: Icon, color = 'primary' }) => {
  const isPositive = change?.startsWith('+');
  const isNegative = change?.startsWith('-');

  const colorClasses = {
    primary: 'from-primary-500/20 to-primary-600/20 border-primary-500/30',
    secondary: 'from-secondary-500/20 to-secondary-600/20 border-secondary-500/30',
    accent: 'from-accent-500/20 to-accent-600/20 border-accent-500/30',
  };

  const iconColors = {
    primary: 'text-primary-400',
    secondary: 'text-secondary-400',
    accent: 'text-accent-400',
  };

  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -2 }}
      className={`glass rounded-xl p-6 bg-gradient-to-br ${colorClasses[color]} border hover:border-opacity-50 transition-all duration-300`}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-gray-400 text-sm font-medium">{title}</p>
          <p className="text-2xl font-bold text-white mt-1">{value}</p>
          {change && (
            <div className="flex items-center mt-2">
              {isPositive && <TrendingUpIcon className="h-4 w-4 text-accent-400 mr-1" />}
              {isNegative && <TrendingDownIcon className="h-4 w-4 text-red-400 mr-1" />}
              <span
                className={`text-sm font-medium ${
                  isPositive ? 'text-accent-400' : isNegative ? 'text-red-400' : 'text-gray-400'
                }`}
              >
                {change}
              </span>
              <span className="text-gray-500 text-sm ml-1">vs last week</span>
            </div>
          )}
        </div>
        <div className={`p-3 rounded-lg bg-white/5 ${iconColors[color]}`}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </motion.div>
  );
};

export default MetricsCard;