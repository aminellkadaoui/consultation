window.CONSULTATION_CONFIG = {
  brand: 'أمين القضاوي',
  headline: 'تعمل كإديتور، لكنك محتار على ماذا تركز الآن؟',
  subheadline: 'نراجع المشكلة التي تواجهك، ونحدد ما يحتاج تركيزك الآن، وما تفعله أولًا.',
  price: 300, currency: 'درهم', durationMinutes: 60, actionDocHours: 24,
  videoUrl: '', videoPoster: '', testimonials: [], bookingUrl: '', contactWhatsapp: '',
  firebase: {
    apiKey: 'AIzaSyAou6PxuGGpDSNnmZ1ja4eMYIke3OR_sXY', authDomain: 'elite-editor-9fe62.firebaseapp.com',
    projectId: 'elite-editor-9fe62', storageBucket: 'elite-editor-9fe62.firebasestorage.app',
    messagingSenderId: '705152552088', appId: '1:705152552088:web:c9b082ee8d5f0a1565d4ed', databaseId: 'default',
    // Public Web Push certificate key from Firebase Console > Cloud Messaging > Web configuration.
    // This is intentionally public and is not an FCM server credential.
    vapidKey: ''
  }
};

if (/(?:^|\/)admin\.html$/.test(location.pathname)) {
  import('./admin-progress.js?v=progress-2').catch((error) => {
    console.error('Progress admin extension failed:', error);
  });

  const notificationStyles = document.createElement('link');
  notificationStyles.rel = 'stylesheet';
  notificationStyles.href = './admin-notifications.css?v=push-1';
  document.head.append(notificationStyles);
  import('./admin-notifications.js?v=push-1').catch((error) => {
    console.error('Admin notification settings failed:', error);
  });

  const adminUxStyles = document.createElement('link');
  adminUxStyles.rel = 'stylesheet';
  adminUxStyles.href = './admin-ux.css?v=archive-ux-1';
  document.head.append(adminUxStyles);
  import('./admin-ux.js?v=archive-ux-1').catch((error) => {
    console.error('Admin UX extension failed:', error);
  });
}

if (/\/Form\/(?:index\.html)?$/.test(location.pathname)) {
  const phoneStyles = document.createElement('link');
  phoneStyles.rel = 'stylesheet';
  phoneStyles.href = './phone-country.css?v=phone-1';
  document.head.append(phoneStyles);

  const adjustFirstStep = () => {
    const firstStep = document.querySelector('#intakeForm fieldset[data-step="0"]');
    if (!firstStep) return false;
    const legend = firstStep.querySelector('legend');
    if (legend) legend.textContent = 'المعلومات الاساسية';
    firstStep.querySelector('.field-intro')?.remove();
    return true;
  };

  if (!adjustFirstStep()) {
    const observer = new MutationObserver(() => {
      if (adjustFirstStep()) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  import('./Form/phone-country.js?v=phone-1').catch((error) => {
    console.error('Phone country picker failed:', error);
  });

  import('./Form/submit-compat.js?v=form-admin-1').catch((error) => {
    console.error('Form compatibility layer failed:', error);
  });
}
