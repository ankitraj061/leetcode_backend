import User from "../models/user.js";
import Problem from "../models/problem.js";
import Submission from "../models/submission.js";
import mongoose from "mongoose";
import SolutionDraft from "../models/solutionDraft.js";
import Discussion from "../models/discussion.js";

export const toggleSaveProblem = async (req, res) => {
  try {
    const { problemId } = req.params;
    const userId = req.user._id;

    // Validate problem exists and is active
    const problem = await Problem.findOne({ _id: problemId, isActive: true });
    if (!problem) {
      return res.status(404).json({ error: "Problem not found or inactive" });
    }

    // REMOVED: Premium access check - users can save any problem

    // Find user and check if problem is already saved
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const isAlreadySaved = user.savedProblems.includes(problemId);
    let message;
    let isSaved;

    if (isAlreadySaved) {
      // Remove from saved problems (unsave)
      await User.findByIdAndUpdate(userId, {
        $pull: { savedProblems: problemId },
      });
      message = "Problem removed from saved list";
      isSaved = false;
    } else {
      // Add to saved problems (save) - $addToSet ensures uniqueness
      await User.findByIdAndUpdate(userId, {
        $addToSet: { savedProblems: problemId },
      });
      message = "Problem saved successfully";
      isSaved = true;
    }

    res.json({
      success: true,
      message,
      isSaved,
      problem: {
        id: problem._id,
        title: problem.title,
        difficulty: problem.difficulty,
        isPremium: problem.isPremium, // Include premium status for UI
      },
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({ error: "Invalid problem ID format" });
    }
    console.error("Error toggling saved problem:", error);
    res.status(500).json({ error: "Failed to toggle saved problem" });
  }
};

export const getAllProblemsForUser = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      difficulty,
      status, // 'solved', 'unsolved', 'attempted'
      type, // 'saved', 'premium', 'free'
      search,
      company,
      topic,
      sortBy = "title", // 'title', 'difficulty', 'acceptance', 'created'
      order = "asc",
    } = req.query;

    const userId = req.user._id;

    // Build match stage for initial filtering
    const matchStage = {
      isActive: true,
      ...(difficulty && { difficulty }),
      ...(type === "premium" && { isPremium: true }),
      ...(type === "free" && { isPremium: false }),
      ...(company && { companies: { $in: [company] } }),
      ...(topic && { tags: { $in: [topic] } }),
    };

    // ✅ Search only by title with regex
    if (search) {
      const searchTerm = search.trim();
      matchStage.title = { 
        $regex: searchTerm, 
        $options: 'i' 
      };
    }

    const pipeline = [
      { $match: matchStage },

      // For saved problems
      ...(type === "saved"
        ? [
            {
              $lookup: {
                from: "users",
                let: { problemId: "$_id" },
                pipeline: [
                  { $match: { _id: userId } },
                  {
                    $project: {
                      hasSaved: { $in: ["$$problemId", "$savedProblems"] },
                    },
                  },
                ],
                as: "savedCheck",
              },
            },
            {
              $match: { "savedCheck.hasSaved": true },
            },
          ]
        : []),

      // Lookup user data (saved + solved)
      {
        $lookup: {
          from: "users",
          let: { problemId: "$_id" },
          pipeline: [
            { $match: { _id: userId } },
            {
              $project: {
                isSaved: { $in: ["$$problemId", "$savedProblems"] },
                isSolved: { $in: ["$$problemId", "$problemsSolved.problemId"] },
              },
            },
          ],
          as: "userStatus",
        },
      },

      // Lookup drafts (for attempted)
      {
        $lookup: {
          from: "solutiondrafts",
          let: { problemId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$problemId", "$$problemId"] },
                    { $eq: ["$userId", userId] },
                  ],
                },
              },
            },
            { $project: { _id: 1 } },
          ],
          as: "draftStatus",
        },
      },

      // Lookup submissions (for attempted but not accepted)
      {
        $lookup: {
          from: "submissions",
          let: { problemId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$problemId", "$$problemId"] },
                    { $eq: ["$userId", userId] },
                    { $ne: ["$status", "accepted"] },
                  ],
                },
              },
            },
            { $limit: 1 },
            { $project: { _id: 1 } },
          ],
          as: "attemptedSubmissions",
        },
      },

      // Lookup acceptance rate
      {
        $lookup: {
          from: "submissions",
          let: { problemId: "$_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$problemId", "$$problemId"] } } },
            {
              $group: {
                _id: null,
                totalSubmissions: { $sum: 1 },
                acceptedSubmissions: {
                  $sum: { $cond: [{ $eq: ["$status", "accepted"] }, 1, 0] },
                },
              },
            },
            {
              $project: {
                acceptanceRate: {
                  $cond: [
                    { $eq: ["$totalSubmissions", 0] },
                    0,
                    {
                      $round: [
                        {
                          $multiply: [
                            {
                              $divide: [
                                "$acceptedSubmissions",
                                "$totalSubmissions",
                              ],
                            },
                            100,
                          ],
                        },
                        2,
                      ],
                    },
                  ],
                },
              },
            },
          ],
          as: "submissionStats",
        },
      },

      // ✅ FIXED: Project fields (removed textScore reference)
      {
        $project: {
          _id: 1,
          title: 1,
          slug: 1,
          difficulty: 1,
          isPremiumProblem: "$isPremium",
          isSavedProblem: {
            $ifNull: [{ $arrayElemAt: ["$userStatus.isSaved", 0] }, false],
          },
          isSolvedByUser: {
            $ifNull: [{ $arrayElemAt: ["$userStatus.isSolved", 0] }, false],
          },
          isAttemptedByUser: {
            $and: [
              {
                $or: [
                  { $gt: [{ $size: "$draftStatus" }, 0] },
                  { $gt: [{ $size: "$attemptedSubmissions" }, 0] },
                ],
              },
              {
                $not: {
                  $ifNull: [
                    { $arrayElemAt: ["$userStatus.isSolved", 0] },
                    false,
                  ],
                },
              },
            ],
          },
          acceptanceRate: {
            $ifNull: [
              { $arrayElemAt: ["$submissionStats.acceptanceRate", 0] },
              0,
            ],
          },
          createdAt: 1
          // ✅ REMOVED: ...(search && { score: { $meta: "textScore" } }),
        },
      },

      // Status filter
      ...(status === "solved" ? [{ $match: { isSolvedByUser: true } }] : []),
      ...(status === "unsolved" ? [{ $match: { isSolvedByUser: false } }] : []),
      ...(status === "attempted"
        ? [{ $match: { isAttemptedByUser: true } }]
        : []),

      // ✅ Sort (already fixed)
      {
        $sort: {
          ...(sortBy === "difficulty" && {
            difficulty: order === "desc" ? -1 : 1,
          }),
          ...(sortBy === "acceptance" && {
            acceptanceRate: order === "desc" ? -1 : 1,
          }),
          ...(sortBy === "created" && { createdAt: order === "desc" ? -1 : 1 }),
          ...(sortBy === "title" && { title: order === "desc" ? -1 : 1 }),
          _id: 1,
        },
      },

      // Pagination
      {
        $facet: {
          problems: [
            { $skip: (page - 1) * parseInt(limit) },
            { $limit: parseInt(limit) },
          ],
          totalCount: [{ $count: "count" }],
        },
      },
    ];

    const [result] = await Problem.aggregate(pipeline);
    const problems = result.problems || [];
    const totalCount = result.totalCount[0]?.count || 0;

    res.json({
      success: true,
      problems,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / limit),
        totalProblems: totalCount,
        hasNext: page * limit < totalCount,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error("Error fetching problems for user (optimized):", error);

    if (error.name === "MongoError") {
      if (error.code === 16389) {
        return res
          .status(400)
          .json({ error: "Query too complex, please refine your filters" });
      }
      if (error.code === 16552) {
        return res.status(400).json({ error: "Invalid search query" });
      }
    }

    res.status(500).json({ error: "Failed to fetch problems" });
  }
};


export const getProblemForUserBySlug = async (req, res) => {
  try {
    const { problemSlug } = req.params;
    const userId = req.user._id;

    if (
      !problemSlug ||
      typeof problemSlug !== "string" ||
      problemSlug.trim() === ""
    ) {
      return res.status(400).json({ error: "Invalid problem slug format" });
    }

    // ✅ Get problem with user status - FIXED VERSION
    const [problemData] = await Problem.aggregate([
      {
        $match: {
          slug: problemSlug,
          isActive: true,
        },
      },
      {
        $lookup: {
          from: "users",
          let: { problemId: "$_id" },
          pipeline: [
            { $match: { _id: new mongoose.Types.ObjectId(userId) } },
            {
              $project: {
                isSaved: {
                  $in: ["$$problemId", "$savedProblems"],
                },
                isSolved: {
                  $in: ["$$problemId", "$problemsSolved.problemId"],
                },
                subscriptionType: 1,
                preferredLanguage: "$preferences.preferredLanguage",
              },
            },
          ],
          as: "userStatus",
        },
      },
      {
        $project: {
          title: 1,
          slug: 1,
          description: 1,
          difficulty: 1,
          constraints: 1,
          visibleTestCases: 1,
          startCode: 1,
          hints: 1,
          companies: 1,
          tags: 1,
          isPremium: 1,
          createdAt: 1,
          userStatus: { $arrayElemAt: ["$userStatus", 0] },
        },
      },
    ]);

    if (!problemData) {
      return res.status(404).json({ error: "Problem not found" });
    }

    const userStatus = problemData.userStatus || {};

    // ✅ Premium access check
    if (problemData.isPremium && userStatus.subscriptionType !== "premium") {
      return res.status(403).json({
        error: "Please subscribe to unlock this problem",
        isPremium: true,
        requiresSubscription: true,
        problem: {
          _id: problemData._id,
          slug: problemData.slug,
          title: problemData.title,
          difficulty: problemData.difficulty,
          isPremium: true,
        },
      });
    }

    const problemObjectId = new mongoose.Types.ObjectId(problemData._id);

    // ✅ Alternative check for isSolved - MORE RELIABLE
    const userSolvedProblem = await User.findOne({
      _id: userId,
      "problemsSolved.problemId": problemObjectId,
    });

    const isSolvedByUser = !!userSolvedProblem;

    // ✅ Get submission stats and discussion stats in parallel
    const [submissionStats, discussionStats, userSubmission, userDraft] =
      await Promise.all([
        // Submission stats
        Submission.aggregate([
          { $match: { problemId: problemObjectId } },
          {
            $group: {
              _id: "$problemId",
              totalSubmissions: { $sum: 1 },
              totalAccepted: {
                $sum: {
                  $cond: [{ $eq: ["$status", "accepted"] }, 1, 0],
                },
              },
            },
          },
        ]),

        // Discussion stats
        Discussion.aggregate([
          { $match: { problemId: problemObjectId } },
          {
            $group: {
              _id: "$problemId",
              totalDiscussions: { $sum: 1 },
              totalReplies: {
                $sum: {
                  $cond: [{ $isArray: "$replies" }, { $size: "$replies" }, 0],
                },
              },
            },
          },
          {
            $project: {
              _id: 1,
              totalDiscussions: 1,
              totalReplies: 1,
              totalDiscussionCount: {
                $add: ["$totalDiscussions", "$totalReplies"],
              },
            },
          },
        ]),

        // User submission
        Submission.findOne({ userId, problemId: problemObjectId }),

        // User draft
        SolutionDraft.findOne({ userId, problemId: problemObjectId }),
      ]);

    const totalSubmissions =
      submissionStats.length > 0 ? submissionStats[0].totalSubmissions : 0;
    const totalAcceptedSubmissions =
      submissionStats.length > 0 ? submissionStats[0].totalAccepted : 0;

    const discussionData = discussionStats.length > 0 ? discussionStats[0] : {};
    const totalDiscussions = discussionData.totalDiscussions || 0;
    const totalReplies = discussionData.totalReplies || 0;
    const totalDiscussionCount = discussionData.totalDiscussionCount || 0;

    const isAttemptedByUser = !!(userSubmission || userDraft);
    const isSubmittedByUser = !!userSubmission;

    const problem = {
      _id: problemData._id,
      slug: problemData.slug,
      title: problemData.title,
      description: problemData.description,
      difficulty: problemData.difficulty,
      constraints: problemData.constraints,
      visibleTestCases: problemData.visibleTestCases,
      startCode: problemData.startCode,
      hints: problemData.hints,
      companies: problemData.companies,
      tags: problemData.tags,
      isPremium: problemData.isPremium,
      createdAt: problemData.createdAt,

      // Stats
      totalSubmissions,
      totalAcceptedSubmissions,

      // Discussion stats
      totalDiscussions,
      totalReplies,
      totalDiscussionCount,
    };

    const userData = {
      preferredLanguage: userStatus.preferredLanguage || "javascript",
      isSavedProblem: userStatus.isSaved || false,
      isSolvedByUser: isSolvedByUser, // ✅ Use the direct check result
      isAttemptedByUser,
      isSubmittedByUser,
      subscriptionType: userStatus.subscriptionType || "free",
    };

    res.json({
      success: true,
      problem,
      userStatus: userData,
    });
  } catch (error) {
    console.error("Error fetching problem for user:", error);
    res.status(500).json({ error: "Failed to fetch problem details" });
  }
};

export const getAllCompaniesWithCount = async (req, res) => {
  console.log("Inside getAllCompaniesWithCount");

  try {
    const pipeline = [
      // Match only active problems
      { $match: { isActive: true } },

      // Unwind the companies array to create separate documents for each company
      { $unwind: "$companies" },

      // Group by company and count problems
      {
        $group: {
          _id: "$companies",
          count: { $sum: 1 },
          difficulties: {
            $push: "$difficulty",
          },
        },
      },

      // Add difficulty breakdown counts
      {
        $addFields: {
          difficultyBreakdown: {
            easy: {
              $size: {
                $filter: {
                  input: "$difficulties",
                  cond: { $eq: ["$$this", "easy"] },
                },
              },
            },
            medium: {
              $size: {
                $filter: {
                  input: "$difficulties",
                  cond: { $eq: ["$$this", "medium"] },
                },
              },
            },
            hard: {
              $size: {
                $filter: {
                  input: "$difficulties",
                  cond: { $eq: ["$$this", "hard"] },
                },
              },
            },
          },
        },
      },

      // Project final structure
      {
        $project: {
          _id: 0,
          company: "$_id",
          count: 1,
          difficultyBreakdown: 1,
        },
      },

      // Sort by count (highest first) then by company name
      { $sort: { count: -1, company: 1 } },
    ];

    const companies = await Problem.aggregate(pipeline);

    res.json({
      success: true,
      companies,
      totalCompanies: companies.length,
    });
  } catch (error) {
    console.error("Error fetching companies with count:", error);
    res.status(500).json({ error: "Failed to fetch companies" });
  }
};

export const getAllTopicsWithCount = async (req, res) => {
  console.log("Inside getAllTopicsWithCount");
  try {
    const pipeline = [
      // Match only active problems
      { $match: { isActive: true } },

      // Unwind the tags array to create separate documents for each tag
      { $unwind: "$tags" },

      // Group by tag and count problems
      {
        $group: {
          _id: "$tags",
          count: { $sum: 1 },
        },
      },

      // Project final structure
      {
        $project: {
          _id: 0,
          topic: "$_id",
          count: 1,
        },
      },

      // Sort by count (highest first) then by topic name
      { $sort: { count: -1, topic: 1 } },
    ];

    const topics = await Problem.aggregate(pipeline);

    res.json({
      success: true,
      topics,
      totalTopics: topics.length,
    });
  } catch (error) {
    console.error("Error fetching topics with count:", error);
    res.status(500).json({ error: "Failed to fetch topics" });
  }
};

export const getSolutionByProblemId = async (req, res) => {
  try {
    const { problemId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(problemId)) {
      return res.status(400).json({ error: "Invalid problem ID format" });
    }

    const problem = await Problem.findById(problemId)
      .select("referenceSolution")
      .lean();
    if (!problem) {
      return res.status(404).json({ error: "Problem not found" });
    }

    res.json({
      success: true,
      referenceSolution: problem.referenceSolution || [],
    });
  } catch (error) {
    console.error("Error fetching reference solution:", error);
    res.status(500).json({ error: "Failed to fetch reference solution" });
  }
};




export const getEditorialByProblemId = async (req, res) => {
  try {
    const { problemId } = req.params;

    // Validate ObjectId
    if (!problemId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid problem ID format'
      });
    }

    // Find problem and select only editorialContent field
    const problem = await Problem.findById(problemId)
      .select('editorialContent title slug');

    if (!problem) {
      return res.status(404).json({
        success: false,
        message: 'Problem not found'
      });
    }

    // Check if editorial content exists
    if (!problem.editorialContent) {
      return res.status(404).json({
        success: false,
        message: 'Editorial content not available for this problem'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        problemId: problem._id,
        title: problem.title,
        slug: problem.slug,
        editorialContent: problem.editorialContent
      }
    });
  } catch (error) {
    console.error('Error fetching editorial:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching editorial content',
      error: error.message
    });
  }
};

