const Report = require('../models/Report');
const User = require('../models/User');
const Stream = require('../models/Stream');
const logger = require('../utils/logger');

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
  }
}

class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NotFoundError';
    this.statusCode = 404;
  }
}

const getReports = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const status = req.query.status; // 'pending', 'under_review', 'resolved', 'dismissed'
    const reporterId = req.query.reporterId;
    const reportedUserId = req.query.reportedUserId;
    const reason = req.query.reason;
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;

    const query = {};

    // Status filter
    if (status) {
      query.status = status;
    }

    // Reporter filter
    if (reporterId) {
      query.reporterId = reporterId;
    }

    // Reported user filter
    if (reportedUserId) {
      query.reportedUserId = reportedUserId;
    }

    // Reason filter
    if (reason) {
      query.reason = reason;
    }

    // Date range filter
    if (startDate || endDate) {
      query.submittedAt = {};
      if (startDate) {
        query.submittedAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.submittedAt.$lte = new Date(endDate);
      }
    }

    // Get total count
    const total = await Report.countDocuments(query);

    // Get reports with pagination and populate user data
    const reports = await Report.find(query)
      .populate('reporterId', 'displayName email profilePictureUrl')
      .populate('reportedUserId', 'displayName email profilePictureUrl userStatus')
      .populate('reportedStreamId', 'title hostId')
      .populate('resolvedBy', 'displayName')
      .sort({ submittedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Format response
    const formattedReports = reports.map(report => ({
      id: report._id,
      reporter: report.reporterId ? {
        id: report.reporterId._id,
        displayName: report.reporterId.displayName,
        email: report.reporterId.email,
        profilePictureUrl: report.reporterId.profilePictureUrl,
      } : null,
      reportedUser: report.reportedUserId ? {
        id: report.reportedUserId._id,
        displayName: report.reportedUserId.displayName,
        email: report.reportedUserId.email,
        profilePictureUrl: report.reportedUserId.profilePictureUrl,
        userStatus: report.reportedUserId.userStatus,
      } : null,
      reportedStream: report.reportedStreamId ? {
        id: report.reportedStreamId._id,
        title: report.reportedStreamId.title,
        hostId: report.reportedStreamId.hostId,
      } : null,
      reason: report.reason,
      description: report.description,
      submittedAt: report.submittedAt,
      status: report.status,
      resolvedBy: report.resolvedBy ? {
        id: report.resolvedBy._id,
        displayName: report.resolvedBy.displayName,
      } : null,
      resolvedAt: report.resolvedAt,
      resolutionNotes: report.resolutionNotes,
      createdAt: report.createdAt,
      updatedAt: report.updatedAt,
    }));

    res.json({
      reports: formattedReports,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('Get admin reports error', {
      error: error.message,
      query: req.query,
    });
    next(error);
  }
};

const getReportDetails = async (req, res, next) => {
  try {
    const { reportId } = req.params;

    const report = await Report.findById(reportId)
      .populate('reporterId', 'displayName email phoneNumber profilePictureUrl registeredAt')
      .populate('reportedUserId', 'displayName email phoneNumber profilePictureUrl userStatus warningCount isBlocked registeredAt')
      .populate('reportedStreamId', 'title hostId startedAt endedAt status')
      .populate('resolvedBy', 'displayName email')
      .lean();

    if (!report) {
      throw new NotFoundError('Report not found');
    }

    // Get additional context if needed
    let streamDetails = null;
    if (report.reportedStreamId) {
      // Get stream host details
      const stream = await Stream.findById(report.reportedStreamId._id)
        .populate('hostId', 'displayName profilePictureUrl')
        .lean();
      
      if (stream) {
        streamDetails = {
          id: stream._id,
          title: stream.title,
          host: stream.hostId ? {
            id: stream.hostId._id,
            displayName: stream.hostId.displayName,
            profilePictureUrl: stream.hostId.profilePictureUrl,
          } : null,
          startedAt: stream.startedAt,
          endedAt: stream.endedAt,
          status: stream.status,
        };
      }
    }

    // Get reporter's previous reports
    const reporterPreviousReports = await Report.countDocuments({
      reporterId: report.reporterId._id,
      _id: { $ne: reportId },
    });

    // Get reported user's previous reports
    const reportedUserPreviousReports = await Report.countDocuments({
      reportedUserId: report.reportedUserId._id,
      _id: { $ne: reportId },
    });

    const reportDetails = {
      id: report._id,
      reporter: report.reporterId ? {
        id: report.reporterId._id,
        displayName: report.reporterId.displayName,
        email: report.reporterId.email,
        phoneNumber: report.reporterId.phoneNumber,
        profilePictureUrl: report.reporterId.profilePictureUrl,
        registeredAt: report.reporterId.registeredAt,
        previousReportsCount: reporterPreviousReports,
      } : null,
      reportedUser: report.reportedUserId ? {
        id: report.reportedUserId._id,
        displayName: report.reportedUserId.displayName,
        email: report.reportedUserId.email,
        phoneNumber: report.reportedUserId.phoneNumber,
        profilePictureUrl: report.reportedUserId.profilePictureUrl,
        userStatus: report.reportedUserId.userStatus,
        warningCount: report.reportedUserId.warningCount,
        isBlocked: report.reportedUserId.isBlocked,
        registeredAt: report.reportedUserId.registeredAt,
        previousReportsCount: reportedUserPreviousReports,
      } : null,
      reportedStream: streamDetails,
      reason: report.reason,
      description: report.description,
      submittedAt: report.submittedAt,
      status: report.status,
      resolvedBy: report.resolvedBy ? {
        id: report.resolvedBy._id,
        displayName: report.resolvedBy.displayName,
        email: report.resolvedBy.email,
      } : null,
      resolvedAt: report.resolvedAt,
      resolutionNotes: report.resolutionNotes,
      createdAt: report.createdAt,
      updatedAt: report.updatedAt,
    };

    res.json({ report: reportDetails });
  } catch (error) {
    logger.error('Get admin report details error', {
      error: error.message,
      reportId: req.params.reportId,
    });
    next(error);
  }
};

const updateReport = async (req, res, next) => {
  try {
    const { reportId } = req.params;
    const { status, action, notes } = req.body;
    const adminId = req.userId; // From authentication middleware

    const report = await Report.findById(reportId);

    if (!report) {
      throw new NotFoundError('Report not found');
    }

    // Validate status
    if (status && !['pending', 'under_review', 'resolved', 'dismissed'].includes(status)) {
      throw new ValidationError('Invalid status value');
    }

    // Validate action if provided
    if (action && !['warning', 'suspension', 'ban'].includes(action)) {
      throw new ValidationError('Invalid action value');
    }

    // Update report status
    if (status) {
      report.status = status;
      
      // If resolving the report, record resolution details
      if (status === 'resolved' || status === 'dismissed') {
        report.resolvedBy = adminId;
        report.resolvedAt = new Date();
        
        if (notes) {
          report.resolutionNotes = notes;
        }
      }
    }

    // Handle actions on reported user
    if (action && report.reportedUserId) {
      const reportedUser = await User.findById(report.reportedUserId);
      
      if (!reportedUser) {
        throw new NotFoundError('Reported user not found');
      }

      switch (action) {
        case 'warning':
          // Increment warning count
          reportedUser.warningCount = (reportedUser.warningCount || 0) + 1;
          
          // If warning count reaches threshold, escalate to suspension
          if (reportedUser.warningCount >= 3) {
            reportedUser.userStatus = 'suspended';
            reportedUser.suspensionEndDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
          } else {
            reportedUser.userStatus = 'warning';
          }
          break;

        case 'suspension':
          // Suspend user for 7 days
          reportedUser.userStatus = 'suspended';
          reportedUser.suspensionEndDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
          break;

        case 'ban':
          // Ban user permanently
          reportedUser.userStatus = 'banned';
          reportedUser.isBlocked = true;
          reportedUser.banReason = notes || 'Banned due to report';
          break;
      }

      await reportedUser.save();
      
      // Add action to resolution notes if not already there
      if (notes) {
        report.resolutionNotes = notes;
      } else {
        report.resolutionNotes = `Action taken: ${action}`;
      }
    }

    await report.save();

    // Get updated report with populated data
    const updatedReport = await Report.findById(reportId)
      .populate('reporterId', 'displayName')
      .populate('reportedUserId', 'displayName userStatus')
      .populate('resolvedBy', 'displayName')
      .lean();

    res.json({
      report: updatedReport,
      message: action ? `Report ${status || 'updated'} and ${action} action applied` : 'Report updated',
    });
  } catch (error) {
    logger.error('Update admin report error', {
      error: error.message,
      reportId: req.params.reportId,
      updates: req.body,
    });
    next(error);
  }
};

module.exports = {
  getReports,
  getReportDetails,
  updateReport,
};