import React, { useMemo } from 'react';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import UrgentActionCard from './UrgentActionCard';

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function getFirstName(user) {
  if (!user) return '';
  if (user.first_name) return user.first_name;
  if (user.name) return user.name.split(' ')[0];
  return '';
}

/**
 * Agentic hero section — answers "What do I need to do today?" in 5 seconds.
 * Merges OperationalAlertsBanner logic into a greeting + urgent action list.
 */
function AgenticHero({
  applications = [],
  applicationEvents = [],
  waterSources = [],
  diseaseAlerts = [],
  onNavigate,
  onOpenWaterTestModal,
}) {
  const { user } = useAuth();
  const firstName = getFirstName(user);

  // Build urgent action items from cross-module data
  const urgentItems = useMemo(() => {
    const items = [];
    const now = new Date();

    // 1. Pending application signatures
    const pendingSigs = applications.filter(a => a.status === 'pending_signature');
    if (pendingSigs.length > 0) {
      items.push({
        id: 'pending-sigs',
        priority: 'high',
        label: `${pendingSigs.length} application${pendingSigs.length > 1 ? 's' : ''} pending signature`,
        cta: 'Sign Now',
        onClick: () => onNavigate?.('applications'),
      });
    }

    // 2. Overdue water tests
    const overdueWater = waterSources.filter(ws => {
      if (!ws.active || !ws.test_frequency || !ws.last_test_date) return false;
      const daysSince = Math.floor((now - new Date(ws.last_test_date)) / 86400000);
      return daysSince > ws.test_frequency;
    });
    if (overdueWater.length > 0) {
      const maxOverdue = Math.max(...overdueWater.map(ws => {
        const daysSince = Math.floor((now - new Date(ws.last_test_date)) / 86400000);
        return daysSince - ws.test_frequency;
      }));
      items.push({
        id: 'overdue-water',
        priority: 'high',
        label: `Water test overdue: ${overdueWater.length === 1 ? overdueWater[0].name : `${overdueWater.length} sources`} (${maxOverdue}d)`,
        cta: 'Log Test',
        onClick: () => onOpenWaterTestModal ? onOpenWaterTestModal() : onNavigate?.('water'),
      });
    }

    // 3. Applications ready for PUR submission (legacy)
    const purReady = applications.filter(a => a.status === 'complete' && !a.submitted_to_pur);
    if (purReady.length > 0) {
      items.push({
        id: 'pur-ready',
        priority: 'medium',
        label: `${purReady.length} application${purReady.length > 1 ? 's' : ''} ready for PUR`,
        cta: 'Review',
        onClick: () => onNavigate?.('reports'),
      });
    }

    // 4. Draft application events (new PUR system)
    const draftEvents = applicationEvents.filter(e => e.pur_status === 'draft');
    if (draftEvents.length > 0) {
      items.push({
        id: 'draft-events',
        priority: 'medium',
        label: `${draftEvents.length} PUR event${draftEvents.length > 1 ? 's' : ''} in draft`,
        cta: 'Review',
        onClick: () => onNavigate?.('reports'),
      });
    }

    // 5. Critical disease alerts
    const criticalDisease = diseaseAlerts.filter(
      a => a.is_active && (a.priority === 'critical' || a.priority === 'high')
    );
    if (criticalDisease.length > 0) {
      items.push({
        id: 'disease-critical',
        priority: 'high',
        label: `${criticalDisease.length} disease alert${criticalDisease.length > 1 ? 's' : ''} nearby`,
        cta: 'View',
        onClick: () => onNavigate?.('disease'),
      });
    }

    // 6. Water tests due soon (within 7 days)
    const dueSoon = waterSources.filter(ws => {
      if (!ws.active || !ws.test_frequency || !ws.last_test_date) return false;
      const daysSince = Math.floor((now - new Date(ws.last_test_date)) / 86400000);
      const remaining = ws.test_frequency - daysSince;
      return remaining > 0 && remaining <= 7;
    });
    if (dueSoon.length > 0) {
      items.push({
        id: 'water-due-soon',
        priority: 'low',
        label: `${dueSoon.length} water test${dueSoon.length > 1 ? 's' : ''} due within 7 days`,
        cta: 'Schedule',
        onClick: () => onNavigate?.('water'),
      });
    }

    return items;
  }, [applications, applicationEvents, waterSources, diseaseAlerts, onNavigate, onOpenWaterTestModal]);

  const highCount = urgentItems.filter(i => i.priority === 'high').length;
  const totalCount = urgentItems.length;

  return (
    <div className="space-y-4">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-semibold text-text dark:text-white">
          {getGreeting()}{firstName ? `, ${firstName}` : ''}.
          {totalCount > 0 ? (
            <span className="text-text-secondary dark:text-gray-400 font-normal">
              {' '}{totalCount} item{totalCount !== 1 ? 's' : ''} need{totalCount === 1 ? 's' : ''} attention.
            </span>
          ) : (
            <span className="text-text-secondary dark:text-gray-400 font-normal">
              {' '}You're all caught up.
            </span>
          )}
        </h1>
      </div>

      {/* Urgent action cards */}
      {urgentItems.length > 0 && (
        <div className="space-y-2">
          {urgentItems.map(item => (
            <UrgentActionCard key={item.id} {...item} />
          ))}
        </div>
      )}
    </div>
  );
}

export default React.memo(AgenticHero);
