import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ChartBarIcon,
  UserGroupIcon,
  ClockIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { Brain, Activity, Zap, Users, TrendingUp, AlertTriangle } from 'lucide-react';
import MetricsCard from './MetricsCard';
import SystemStatus from './SystemStatus';
import RecentAssessments from './RecentAssessments';
import FrameworkOverview from './FrameworkOverview';

const Dashboard = () => {
  const [systemMetrics, setSystemMetrics] = useState({
    totalAssessments: 1247,
    activeUsers: 89,
    accuracyRate: 97.3,
    processingTime: 2.4,
    systemLoad: 34,
    errorRate: 0.02,
  });

  const [realtimeData, setRealtimeData] = useState([]);

  useEffect(() => {
    // Simulate real-time data updates
    const interval = setInterval(() => {
      setRealtimeData(prev => [
        ...prev.slice(-20),
        {
          timestamp: new Date().toLocaleTimeString(),
          accuracy: 95 + Math.random() * 5,
          processing: 2 + Math.random() * 2,
          load: 30 + Math.random() * 20,
        }
      ]);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        duration: 0.5,
      },
    },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="min-h-screen p-6"
    >
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <motion.div variants={itemVariants} className="text-center space-y-4">
          <h1 className="text-4xl md:text-5xl font-bold gradient-text">
            ConversaTrait Dashboard
          </h1>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Advanced AI-powered personality assessment using 17+ psychoanalytical frameworks
          </p>
          
          {/* Live Status Banner */}
          <div className="inline-flex items-center space-x-2 px-4 py-2 rounded-full bg-accent-500/20 border border-accent-500/30">
            <div className="w-2 h-2 bg-accent-400 rounded-full animate-pulse" />
            <span className="text-sm text-accent-400 font-medium">
              Beta System Active • {systemMetrics.activeUsers} Users Online
            </span>
          </div>
        </motion.div>

        {/* Key Metrics */}
        <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricsCard
            title="Total Assessments"
            value={systemMetrics.totalAssessments.toLocaleString()}
            change="+12.5%"
            icon={ChartBarIcon}
            color="primary"
          />
          <MetricsCard
            title="Accuracy Rate"
            value={`${systemMetrics.accuracyRate}%`}
            change="+0.3%"
            icon={ShieldCheckIcon}
            color="accent"
          />
          <MetricsCard
            title="Active Users"
            value={systemMetrics.activeUsers}
            change="+8.2%"
            icon={UserGroupIcon}
            color="secondary"
          />
          <MetricsCard
            title="Avg Processing"
            value={`${systemMetrics.processingTime}s`}
            change="-0.2s"
            icon={ClockIcon}
            color="primary"
          />
        </motion.div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-8">
            {/* System Status */}
            <motion.div variants={itemVariants}>
              <SystemStatus metrics={systemMetrics} realtimeData={realtimeData} />
            </motion.div>

            {/* Recent Assessments */}
            <motion.div variants={itemVariants}>
              <RecentAssessments />
            </motion.div>
          </div>

          {/* Right Column */}
          <div className="space-y-8">
            {/* Framework Overview */}
            <motion.div variants={itemVariants}>
              <FrameworkOverview />
            </motion.div>

            {/* Quick Actions */}
            <motion.div variants={itemVariants} className="glass rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                <Zap className="h-5 w-5 text-primary-400 mr-2" />
                Quick Actions
              </h3>
              <div className="space-y-3">
                <button className="w-full flex items-center justify-between p-3 rounded-lg bg-primary-500/20 border border-primary-500/30 text-primary-400 hover:bg-primary-500/30 transition-all duration-200">
                  <span className="font-medium">New Assessment</span>
                  <ChartBarIcon className="h-5 w-5" />
                </button>
                <button className="w-full flex items-center justify-between p-3 rounded-lg bg-secondary-500/20 border border-secondary-500/30 text-secondary-400 hover:bg-secondary-500/30 transition-all duration-200">
                  <span className="font-medium">View Analytics</span>
                  <TrendingUp className="h-5 w-5" />
                </button>
                <button className="w-full flex items-center justify-between p-3 rounded-lg bg-accent-500/20 border border-accent-500/30 text-accent-400 hover:bg-accent-500/30 transition-all duration-200">
                  <span className="font-medium">Export Data</span>
                  <Activity className="h-5 w-5" />
                </button>
              </div>
            </motion.div>

            {/* System Health */}
            <motion.div variants={itemVariants} className="glass rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                <Shield className="h-5 w-5 text-accent-400 mr-2" />
                System Health
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-300">API Pipeline</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-accent-400 rounded-full animate-pulse" />
                    <span className="text-accent-400 text-sm font-medium">Operational</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-300">Safety Checks</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-accent-400 rounded-full animate-pulse" />
                    <span className="text-accent-400 text-sm font-medium">Active</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-300">LLM Processing</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
                    <span className="text-yellow-400 text-sm font-medium">High Load</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-300">WebSocket</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse" />
                    <span className="text-red-400 text-sm font-medium">Issues Detected</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Beta Notice */}
        <motion.div 
          variants={itemVariants}
          className="mt-8 p-4 rounded-xl bg-gradient-to-r from-primary-500/20 to-secondary-500/20 border border-primary-500/30"
        >
          <div className="flex items-center justify-center space-x-2">
            <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400" />
            <span className="text-yellow-400 font-medium">
              Beta Testing Phase - Launch: August 6th, 2025 at 8:06 AM PST
            </span>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default Dashboard;