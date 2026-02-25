import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Info,
  TrendingUp,
  Droplets,
  Leaf,
  TreePine,
  Clock,
} from 'lucide-react';

/**
 * Step 7: Risk Review
 *
 * Display calculated risk scores and FDA determination.
 */
const Step7RiskReview = ({ formData, assessment, onCalculateRisk }) => {
  const getRiskColor = (level) => {
    const colors = {
      low: 'text-primary dark:text-green-400',
      medium: 'text-yellow-600 dark:text-yellow-400',
      high: 'text-orange-600 dark:text-orange-400',
      critical: 'text-red-600 dark:text-red-400',
    };
    return colors[level] || 'text-gray-600';
  };

  const getRiskBgColor = (level) => {
    const colors = {
      low: 'bg-green-100 dark:bg-green-900/40',
      medium: 'bg-yellow-100 dark:bg-yellow-900/40',
      high: 'bg-orange-100 dark:bg-orange-900/40',
      critical: 'bg-red-100 dark:bg-red-900/40',
    };
    return colors[level] || 'bg-gray-100 dark:bg-gray-700';
  };

  const getScoreBarWidth = (score) => {
    return `${Math.min(100, score || 0)}%`;
  };

  const getScoreBarColor = (score) => {
    if (score <= 25) return 'bg-green-500';
    if (score <= 50) return 'bg-yellow-500';
    if (score <= 75) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getFdaDeterminationInfo = (determination) => {
    const info = {
      no_treatment: {
        label: 'No Treatment Required',
        description: 'Water meets FDA standards and can be used without treatment',
        icon: CheckCircle2,
        color: 'text-primary dark:text-green-400',
        bgColor: 'bg-primary-light dark:bg-green-900/20',
        borderColor: 'border-green-200 dark:border-green-800',
      },
      treatment_required: {
        label: 'Treatment Required',
        description: 'Water must be treated before use on produce',
        icon: AlertTriangle,
        color: 'text-red-600 dark:text-red-400',
        bgColor: 'bg-red-50 dark:bg-red-900/20',
        borderColor: 'border-red-200 dark:border-red-800',
      },
      die_off_required: {
        label: 'Die-off Interval Required',
        description: 'Allow sufficient time between last application and harvest',
        icon: Clock,
        color: 'text-yellow-600 dark:text-yellow-400',
        bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
        borderColor: 'border-yellow-200 dark:border-yellow-800',
      },
      testing_required: {
        label: 'Additional Testing Required',
        description: 'More water quality data needed to make determination',
        icon: Info,
        color: 'text-blue-600 dark:text-blue-400',
        bgColor: 'bg-blue-50 dark:bg-blue-900/20',
        borderColor: 'border-blue-200 dark:border-blue-800',
      },
    };
    return info[determination] || info.testing_required;
  };

  const riskCategories = [
    {
      key: 'source',
      label: 'Source Quality',
      score: assessment?.source_risk_score,
      weight: '30%',
      icon: Droplets,
      description: 'Based on E. coli levels, physical condition, and contamination risks',
    },
    {
      key: 'application',
      label: 'Application Method',
      score: assessment?.application_risk_score,
      weight: '25%',
      icon: Leaf,
      description: 'Based on irrigation type and water-crop contact',
    },
    {
      key: 'environmental',
      label: 'Environmental',
      score: assessment?.environmental_risk_score,
      weight: '25%',
      icon: TreePine,
      description: 'Based on animal operations, flooding, wildlife pressure',
    },
    {
      key: 'timing',
      label: 'Timing',
      score: assessment?.timing_risk_score,
      weight: '20%',
      icon: Clock,
      description: 'Based on days before harvest and die-off interval compliance',
    },
  ];

  const hasRiskScores = assessment?.overall_risk_score !== null && assessment?.overall_risk_score !== undefined;

  return (
    <div className="space-y-6">
      {/* Calculate Risk Button */}
      {!hasRiskScores && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6 text-center">
          <Info className="w-12 h-12 text-blue-600 dark:text-blue-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-blue-900 dark:text-blue-300 mb-2">
            Ready to Calculate Risk
          </h3>
          <p className="text-sm text-blue-700 dark:text-blue-400 mb-4">
            Click the button below to calculate risk scores based on your assessment data.
          </p>
          <button
            onClick={onCalculateRisk}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <RefreshCw className="w-5 h-5" />
            Calculate Risk Scores
          </button>
        </div>
      )}

      {hasRiskScores && (
        <>
          {/* Overall Risk Score */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Overall Risk Assessment
              </h3>
              <button
                onClick={onCalculateRisk}
                className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              >
                <RefreshCw className="w-4 h-4" />
                Recalculate
              </button>
            </div>

            <div className="flex items-center gap-6">
              {/* Score Circle */}
              <div className="flex-shrink-0">
                <div
                  className={`w-24 h-24 rounded-full flex items-center justify-center ${getRiskBgColor(
                    assessment.risk_level
                  )}`}
                >
                  <div className="text-center">
                    <span
                      className={`text-3xl font-bold ${getRiskColor(assessment.risk_level)}`}
                    >
                      {Math.round(assessment.overall_risk_score)}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400 block">
                      / 100
                    </span>
                  </div>
                </div>
              </div>

              {/* Risk Level */}
              <div className="flex-1">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Risk Level</p>
                <p className={`text-2xl font-bold capitalize ${getRiskColor(assessment.risk_level)}`}>
                  {assessment.risk_level}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  {assessment.risk_level === 'low' &&
                    'Water appears safe for use with current practices'}
                  {assessment.risk_level === 'medium' &&
                    'Some concerns identified - review recommended actions'}
                  {assessment.risk_level === 'high' &&
                    'Significant risks identified - corrective actions required'}
                  {assessment.risk_level === 'critical' &&
                    'Critical issues - immediate action required before water use'}
                </p>
              </div>
            </div>
          </div>

          {/* FDA Determination */}
          {assessment.fda_determination && (
            <div
              className={`border rounded-xl p-6 ${
                getFdaDeterminationInfo(assessment.fda_determination).bgColor
              } ${getFdaDeterminationInfo(assessment.fda_determination).borderColor}`}
            >
              <div className="flex items-start gap-4">
                {React.createElement(
                  getFdaDeterminationInfo(assessment.fda_determination).icon,
                  {
                    className: `w-8 h-8 ${
                      getFdaDeterminationInfo(assessment.fda_determination).color
                    }`,
                  }
                )}
                <div>
                  <h3
                    className={`text-lg font-semibold ${
                      getFdaDeterminationInfo(assessment.fda_determination).color
                    }`}
                  >
                    {getFdaDeterminationInfo(assessment.fda_determination).label}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mt-1">
                    {getFdaDeterminationInfo(assessment.fda_determination).description}
                  </p>

                  {assessment.required_die_off_days > 0 && (
                    <div className="mt-4 p-3 bg-white/50 dark:bg-gray-800/50 rounded-lg">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Required Die-off Interval:{' '}
                        <span className="text-lg font-bold">
                          {assessment.required_die_off_days} days
                        </span>
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Allow this many days between last water application and harvest
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Risk Category Breakdown */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
              Risk Score Breakdown
            </h3>

            <div className="space-y-6">
              {riskCategories.map((category) => (
                <div key={category.key}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <category.icon className="w-5 h-5 text-gray-500" />
                      <span className="font-medium text-gray-900 dark:text-white">
                        {category.label}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        ({category.weight})
                      </span>
                    </div>
                    <span className="font-bold text-gray-900 dark:text-white">
                      {category.score !== null && category.score !== undefined
                        ? Math.round(category.score)
                        : 'N/A'}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${getScoreBarColor(
                        category.score
                      )}`}
                      style={{ width: getScoreBarWidth(category.score) }}
                    />
                  </div>

                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {category.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Mitigation Actions */}
          {formData.mitigationActions?.length > 0 && (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Recommended Corrective Actions
              </h3>

              <div className="space-y-3">
                {formData.mitigationActions.map((action, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-lg border ${
                      action.priority === 'critical'
                        ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20'
                        : action.priority === 'high'
                        ? 'border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20'
                        : 'border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <AlertTriangle
                        className={`w-5 h-5 flex-shrink-0 ${
                          action.priority === 'critical'
                            ? 'text-red-600'
                            : action.priority === 'high'
                            ? 'text-orange-600'
                            : 'text-yellow-600'
                        }`}
                      />
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {action.action_description}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                          <span className="capitalize">Priority: {action.priority}</span>
                          {action.due_date && <span>Due: {action.due_date}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Info Box */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium text-blue-900 dark:text-blue-300 mb-1">
              Understanding Risk Scores
            </h4>
            <p className="text-sm text-blue-700 dark:text-blue-400">
              Risk scores are calculated using FDA guidelines and weighted factors. Lower scores
              indicate lower risk. Scores above 50 typically require corrective actions. The FDA
              determination provides guidance on required water treatment or die-off intervals.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Step7RiskReview;
