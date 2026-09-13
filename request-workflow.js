export const activeStatuses = ['new', 'reviewing', 'accepted', 'scheduled', 'completed', 'archived'];
export function filterRequests(items, status = 'all', query = '') {
  const search = query.trim().toLocaleLowerCase();
  return items.filter(item => (status === 'all' ? item.status !== 'trash' : item.status === status)
    && (!search || [item.fullName, item.instagram, item.whatsapp, item.problem, item.goal,
      ...(Array.isArray(item.editingType) ? item.editingType : [item.editingType]), item.lastSituation]
      .join(' ').toLocaleLowerCase().includes(search)));
}
export function previousStatus(item) {
  return activeStatuses.includes(item.trashPreviousStatus) ? item.trashPreviousStatus : 'new';
}
export function guardStatusChange(existing, changes) {
  if (changes.status !== undefined && changes.status !== existing.status
    && (changes.status === 'trash' || existing.status === 'trash')) {
    throw new Error('استخدم زر النقل إلى المهملات أو الاسترجاع لتغيير هذه الحالة.');
  }
}
