window.CONSULTATION_CONFIG = {
  brand: 'أمين القداوي',
  headline: 'تعمل كإديتور، لكنك محتار على ماذا تركز الآن؟',
  subheadline: 'نراجع المشكلة التي تواجهك، ونحدد ما يحتاج تركيزك الآن، وما تفعله أولًا.',
  price: 300, currency: 'درهم', durationMinutes: 60, actionDocHours: 24,
  videoUrl: '', videoPoster: '', testimonials: [], bookingUrl: '', contactWhatsapp: '',
  firebase: {
    apiKey: 'AIzaSyAou6PxuGGpDSNnmZ1ja4eMYIke3OR_sXY', authDomain: 'elite-editor-9fe62.firebaseapp.com',
    projectId: 'elite-editor-9fe62', storageBucket: 'elite-editor-9fe62.firebasestorage.app',
    messagingSenderId: '705152552088', appId: '1:705152552088:web:c9b082ee8d5f0a1565d4ed', databaseId: 'default'
  }
};

if (/(?:^|\/)admin\.html$/.test(location.pathname)) {
  import('./admin-progress.js?v=progress-2').catch((error) => {
    console.error('Progress admin extension failed:', error);
  });
}

if (/\/Form\/(?:index\.html)?$/.test(location.pathname)) {
  const phoneStyles = document.createElement('link');
  phoneStyles.rel = 'stylesheet';
  phoneStyles.href = './phone-country.css?v=phone-1';
  document.head.append(phoneStyles);

  import('./Form/phone-country.js?v=phone-1').catch((error) => {
    console.error('Phone country picker failed:', error);
  });

  import('./Form/submit-compat.js?v=form-admin-1').catch((error) => {
    console.error('Form compatibility layer failed:', error);
  });
}
