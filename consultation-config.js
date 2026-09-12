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
  import('./admin-progress.js?v=progress-1').catch((error) => {
    console.error('Progress admin extension failed:', error);
  });
}
