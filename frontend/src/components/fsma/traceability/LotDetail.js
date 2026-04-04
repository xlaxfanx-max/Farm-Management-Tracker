import React, { useState, useEffect, useCallback } from 'react';
import {
  ChevronLeft, Package, MapPin, Truck, CheckCircle2,
  XCircle, Clock, AlertTriangle, FileText, ArrowRight,
  Droplets, Leaf, Users, Beaker, Shield, RefreshCw,
} from 'lucide-react';
import { traceabilityAPI } from '../../../services/api';

const LotDetail = ({ lotId, onBack }) => {
  const [trace, setTrace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeSection, setActiveSection] = useState('timeline');

  const loadTrace = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await traceabilityAPI.getFullTrace(lotId);
      setTrace(data);
      setError(null);
    } catch (err) {
      setError('Failed to load trace report');
    } finally {
      setLoading(false);
    }
  }, [lotId]);

  useEffect(() => {
    loadTrace();
  }, [loadTrace]);

  if (loading) {
    return (
      <div className="text-center py-12 text-gray-500">
        <RefreshCw className="w-8 h-8 mx-auto mb-3 animate-spin text-gray-300" />
        Assembling full trace report...
      </div>
    );
  }

  if (error || !trace) {
    return (
      <div className="space-y-4">
        <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-700">
          &larr; Back
        </button>
        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 text-red-700 dark:text-red-400">
          {error || 'Lot not found'}
        </div>
      </div>
    );
  }

  const { lot, one_step_back, critical_tracking_events, one_step_forward, compliance, incidents } = trace;

  const sections = [
    { id: 'timeline', label: 'CTE Timeline', icon: Clock },
    { id: 'one-back', label: 'One Step Back', icon: MapPin },
    { id: 'one-forward', label: 'One Step Forward', icon: ArrowRight },
    { id: 'compliance', label: 'Compliance', icon: Shield },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white font-mono">
              {lot.lot_number}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {lot.product_description} &middot; {lot.harvest_date}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <CompletenessBar score={lot.completeness_score} />
          {lot.fda_response_ready ? (
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 rounded-full text-xs font-medium">
              <CheckCircle2 className="w-3 h-3" /> FDA Ready
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400 rounded-full text-xs font-medium">
              <Clock className="w-3 h-3" /> Incomplete
            </span>
          )}
        </div>
      </div>

      {/* Lot Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <InfoCard label="Farm" value={lot.farm_name || '-'} />
        <InfoCard label="Field" value={lot.field_name || '-'} />
        <InfoCard label="Quantity" value={lot.quantity_bins ? `${lot.quantity_bins} bins` : '-'} />
        <InfoCard label="Weight" value={lot.quantity_weight_lbs ? `${Number(lot.quantity_weight_lbs).toLocaleString()} lbs` : '-'} />
        <InfoCard
          label="Status"
          value={lot.status_display}
          className="capitalize"
        />
      </div>

      {/* Section Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-4 -mb-px">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeSection === section.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <section.icon className="w-4 h-4" />
              {section.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Section Content */}
      {activeSection === 'timeline' && (
        <CTETimeline events={critical_tracking_events} />
      )}
      {activeSection === 'one-back' && (
        <OneStepBack data={one_step_back} />
      )}
      {activeSection === 'one-forward' && (
        <OneStepForward data={one_step_forward} />
      )}
      {activeSection === 'compliance' && (
        <ComplianceSection data={compliance} incidents={incidents} />
      )}
    </div>
  );
};

// Completeness progress bar
const CompletenessBar = ({ score }) => (
  <div className="flex items-center gap-2">
    <div className="w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${
          score >= 80 ? 'bg-green-500' : score >= 50 ? 'bg-amber-500' : 'bg-red-500'
        }`}
        style={{ width: `${score}%` }}
      />
    </div>
    <span className="text-xs text-gray-500">{score}%</span>
  </div>
);

// Simple info card
const InfoCard = ({ label, value, className = '' }) => (
  <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
    <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
    <div className={`text-sm font-medium text-gray-900 dark:text-white mt-1 ${className}`}>
      {value}
    </div>
  </div>
);

// CTE Timeline
const CTETimeline = ({ events }) => {
  if (!events || events.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No Critical Tracking Events recorded yet.
      </div>
    );
  }

  const typeIcons = {
    growing: Leaf,
    shipping: Truck,
    receiving: Package,
    transforming: Beaker,
    creating: FileText,
  };

  const typeColors = {
    growing: 'bg-green-500',
    shipping: 'bg-blue-500',
    receiving: 'bg-indigo-500',
    transforming: 'bg-purple-500',
    creating: 'bg-teal-500',
  };

  return (
    <div className="space-y-0">
      {events.map((event, idx) => {
        const Icon = typeIcons[event.event_type] || Clock;
        const dotColor = typeColors[event.event_type] || 'bg-gray-500';

        return (
          <div key={event.id} className="flex gap-4">
            {/* Timeline line */}
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full ${dotColor} flex items-center justify-center flex-shrink-0`}>
                <Icon className="w-4 h-4 text-white" />
              </div>
              {idx < events.length - 1 && (
                <div className="w-0.5 h-full bg-gray-200 dark:bg-gray-700 min-h-[2rem]" />
              )}
            </div>

            {/* Event content */}
            <div className="pb-6 flex-1">
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-900 dark:text-white">
                    {event.event_type_display}
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(event.event_date).toLocaleDateString()}
                  </span>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <div className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> {event.location_name}
                  </div>
                  {event.trading_partner_name && (
                    <div>Partner: {event.trading_partner_name} ({event.trading_partner_type})</div>
                  )}
                  {event.quantity_bins && <div>Quantity: {event.quantity_bins} bins</div>}
                  {event.truck_id && (
                    <div className="flex items-center gap-1">
                      <Truck className="w-3 h-3" />
                      Truck: {event.truck_id}
                      {event.driver_name && ` (${event.driver_name})`}
                      {event.temperature_f && ` @ ${event.temperature_f}°F`}
                    </div>
                  )}
                  {event.reference_document_number && (
                    <div className="flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      {event.reference_document_type}: {event.reference_document_number}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// One Step Back
const OneStepBack = ({ data }) => (
  <div className="space-y-4">
    {/* Origin */}
    {(data.farm || data.field) && (
      <Section title="Origin" icon={MapPin}>
        {data.farm && <div>Farm: <strong>{data.farm.name}</strong></div>}
        {data.field && <div>Field: <strong>{data.field.name}</strong> ({data.field.acreage} acres)</div>}
      </Section>
    )}

    {/* Pesticide Applications */}
    {data.pesticide_applications?.length > 0 && (
      <Section title="Pesticide Applications" icon={Leaf} count={data.pesticide_applications.length}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 text-xs">
                <th className="pb-2">Date</th>
                <th className="pb-2">Product</th>
                <th className="pb-2">PHI Days</th>
                <th className="pb-2">Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {data.pesticide_applications.map((app, i) => (
                <tr key={i}>
                  <td className="py-1.5">{app.date}</td>
                  <td className="py-1.5">{app.product}</td>
                  <td className="py-1.5">{app.phi_days ?? '-'}</td>
                  <td className="py-1.5">{app.rate ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    )}

    {/* Nutrient Applications */}
    {data.nutrient_applications?.length > 0 && (
      <Section title="Nutrient Applications" icon={Droplets} count={data.nutrient_applications.length}>
        {data.nutrient_applications.map((app, i) => (
          <div key={i} className="text-sm py-1">
            {app.date} &mdash; {app.product} {app.rate && `(${app.rate})`}
          </div>
        ))}
      </Section>
    )}

    {/* Visitors */}
    {data.visitors?.length > 0 && (
      <Section title="Visitors on Harvest Date" icon={Users} count={data.visitors.length}>
        {data.visitors.map((v, i) => (
          <div key={i} className="text-sm py-1">
            {v.name} ({v.company}) &mdash; {v.purpose}
          </div>
        ))}
      </Section>
    )}

    {/* Labor */}
    {data.labor?.length > 0 && (
      <Section title="Harvest Crews" icon={Users} count={data.labor.length}>
        {data.labor.map((l, i) => (
          <div key={i} className="text-sm py-1 flex items-center gap-2">
            <span>{l.contractor || 'Direct hire'} &mdash; {l.crew_name}, {l.workers} workers</span>
            {l.training_verified ? (
              <CheckCircle2 className="w-3 h-3 text-green-500 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-3 h-3 text-amber-500 flex-shrink-0" />
            )}
          </div>
        ))}
      </Section>
    )}

    {/* Empty state */}
    {!data.farm && !data.field &&
     !data.pesticide_applications?.length &&
     !data.nutrient_applications?.length &&
     !data.visitors?.length &&
     !data.labor?.length && (
      <div className="text-center py-8 text-gray-500">
        No upstream data linked to this lot yet.
      </div>
    )}
  </div>
);

// One Step Forward
const OneStepForward = ({ data }) => (
  <div className="space-y-4">
    {/* Loads */}
    {data.loads?.length > 0 && (
      <Section title="Harvest Loads (Shipping)" icon={Truck} count={data.loads.length}>
        {data.loads.map((load, i) => (
          <div key={i} className="text-sm py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
            <div className="font-medium">Load #{load.load_number} &rarr; {load.buyer || 'Unknown buyer'}</div>
            <div className="text-gray-500 mt-1">
              {load.bins && `${load.bins} bins`}
              {load.truck_id && ` | Truck: ${load.truck_id}`}
              {load.temperature_f && ` | ${load.temperature_f}°F`}
            </div>
          </div>
        ))}
      </Section>
    )}

    {/* Deliveries */}
    {data.deliveries?.length > 0 && (
      <Section title="Packinghouse Deliveries (Receiving)" icon={Package} count={data.deliveries.length}>
        {data.deliveries.map((d, i) => (
          <div key={i} className="text-sm py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
            <div className="font-medium">Ticket #{d.ticket_number}</div>
            <div className="text-gray-500 mt-1">
              {d.packinghouse} / {d.pool} | {d.delivery_date} | {d.bins} bins
            </div>
          </div>
        ))}
      </Section>
    )}

    {/* Dispositions */}
    {data.dispositions?.length > 0 && (
      <Section title="Final Disposition" icon={FileText} count={data.dispositions.length}>
        {data.dispositions.map((d, i) => (
          <div key={i} className="text-sm py-2">
            <span className="font-medium">{d.type}</span>
            {d.buyer && ` &rarr; ${d.buyer}`}
            {d.quantity_bins && ` (${d.quantity_bins} bins)`}
            <span className="text-gray-500"> &mdash; {d.date}</span>
          </div>
        ))}
      </Section>
    )}

    {!data.loads?.length && !data.deliveries?.length && !data.dispositions?.length && (
      <div className="text-center py-8 text-gray-500">
        No downstream data linked to this lot yet.
      </div>
    )}
  </div>
);

// Compliance Section
const ComplianceSection = ({ data, incidents }) => (
  <div className="space-y-4">
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <ComplianceCard
        label="PHI Compliant"
        value={data.phi_compliant}
        type="boolean"
      />
      <ComplianceCard
        label="Water Assessment"
        value={data.water_assessment_status}
        type="status"
      />
      <ComplianceCard
        label="FDA Ready"
        value={data.fda_response_ready}
        type="boolean"
      />
      <ComplianceCard
        label="Completeness"
        value={`${data.completeness_score}%`}
        type="score"
        score={data.completeness_score}
      />
    </div>

    {/* Facility cleanings */}
    {data.facility_cleanings?.length > 0 && (
      <Section title="Facility Cleanings (7-day window)" icon={CheckCircle2}>
        {data.facility_cleanings.map((c, i) => (
          <div key={i} className="text-sm py-1 flex items-center gap-2">
            <span>{c.facility} &mdash; {c.date}</span>
            {c.sanitizer_applied && <span className="text-green-600 text-xs">Sanitized</span>}
            {c.verified && <CheckCircle2 className="w-3 h-3 text-green-500" />}
          </div>
        ))}
      </Section>
    )}

    {/* Incidents */}
    {incidents?.length > 0 && (
      <Section title="Contamination Incidents" icon={AlertTriangle}>
        {incidents.map((inc) => (
          <div key={inc.id} className="text-sm py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
            <div className="flex items-center justify-between">
              <span className="font-medium text-red-600 dark:text-red-400">
                {inc.contamination_type_display}
              </span>
              <span className="text-xs text-gray-500">{inc.incident_date}</span>
            </div>
            <div className="text-gray-500 mt-1">{inc.description?.substring(0, 200)}</div>
          </div>
        ))}
      </Section>
    )}
  </div>
);

// Reusable section wrapper
const Section = ({ title, icon: Icon, count, children }) => (
  <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
    <div className="flex items-center gap-2 mb-3">
      {Icon && <Icon className="w-4 h-4 text-gray-400" />}
      <h3 className="font-medium text-gray-900 dark:text-white">{title}</h3>
      {count !== undefined && (
        <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-full">
          {count}
        </span>
      )}
    </div>
    <div className="text-gray-700 dark:text-gray-300">{children}</div>
  </div>
);

// Compliance card
const ComplianceCard = ({ label, value, type, score }) => {
  let display;
  let colorClass = '';

  if (type === 'boolean') {
    if (value === true) {
      display = <CheckCircle2 className="w-5 h-5 text-green-500" />;
      colorClass = 'bg-green-50 dark:bg-green-900/20';
    } else if (value === false) {
      display = <XCircle className="w-5 h-5 text-red-500" />;
      colorClass = 'bg-red-50 dark:bg-red-900/20';
    } else {
      display = <Clock className="w-5 h-5 text-gray-400" />;
    }
  } else if (type === 'status') {
    display = <span className="text-sm capitalize">{value?.replace('_', ' ') || 'Not assessed'}</span>;
    colorClass = value === 'approved' ? 'bg-green-50 dark:bg-green-900/20' : '';
  } else if (type === 'score') {
    display = <span className="text-lg font-bold">{value}</span>;
    colorClass = score >= 80 ? 'bg-green-50 dark:bg-green-900/20' :
                 score >= 50 ? 'bg-amber-50 dark:bg-amber-900/20' :
                 'bg-red-50 dark:bg-red-900/20';
  }

  return (
    <div className={`rounded-lg border border-gray-200 dark:border-gray-700 p-3 ${colorClass}`}>
      <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">{label}</div>
      <div className="flex items-center justify-center">{display}</div>
    </div>
  );
};

export default LotDetail;
