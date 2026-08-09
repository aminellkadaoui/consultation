/* ============================================================
   لوحة التحكم في المحتوى — كل شيء يُعرض على الموقع من هنا
   عدّل هذا الملف يدوياً، أو استعمل admin.html (الداشبورد)
   المحتوى الأساسي = الإنجليزية. الترجمات في i18n (عربية + دارجة).
   ============================================================ */
window.SITE_CONFIG = {
  brand: "Amine Editing Team",

  /* رابط زر الحجز — Calendly / TidyCal / واتساب / Google Calendar... */
  bookACallUrl: "https://calendar.app.google/Wox9zm9zaCydyEkG8",
  bookACallText: "Book A Call",

  /* القسم العلوي (Hero) — الإنجليزية */
  hero: {
    line1: "Make Your Content Look",
    line2: "As Strong As Your",
    line3: "Expertise",
    subtitle: "Turning your expertise into ready-to-publish videos that build trust, authority, and attract leads.",
    videoId: "Uxsu1WrvefQ"
  },

  workLabel: "Portfolio",
  workTitle: "Our Best Work",

  /* الريلز — مرتّبة كأزواج: كل زوج = عمود/عميل واحد (فيديو فوق + فيديو تحت) */
  reels: [
    { id: "eoiDtYK9i2M", views: "296K" },
    { id: "Ytu0_ETdSBk", views: "150K" },
    { id: "IOmmXnQNBY0", views: "257K" },
    { id: "baKkfTYGkkI", views: "122K" },
    { id: "3fQCQ6n434E", views: "158K" },
    { id: "bqGQXk0KZPA", views: "283K" }
  ],

  closing: {
    titlePlain: "What are you",
    titleAccent: "waiting for?",
    line1: "You've seen the work. You know what's possible.",
    line2: "The only question is: are you ready to take action? 👇"
  },

  /* قسم طريقة العمل */
  process: {
    label: "Workflow",
    title: "Our Process",
    subtitle: "A simple workflow built to understand your project, create your unique editing style, and improve your content over time.",
    steps: [
      { title: "Project Details", desc: "We receive the key details about your business, offer, audience, references, and brand direction." },
      { title: "Unique Editing Style", desc: "We create a custom editing style built around your brand, expertise, and authority." },
      { title: "Delivery & Analysis", desc: "We deliver ready-to-publish videos and review what performs best to improve the next content." }
    ]
  },

  /* قسم معايير العمل — أرقام حمراء بدل الأيقونات */
  guidelines: {
    label: "Guidelines",
    title: "Work Guidelines",
    subtitle: "We work with selected clients whose content aligns with our values and production standards.",
    steps: [
      { title: "No Music", desc: "We do not use music in our edits. We focus on clean sound design, clarity, pacing, and visual storytelling." },
      { title: "No Women's Images", desc: "We do not include women's images or scenes in the videos we produce." },
      { title: "Selective Content", desc: "We only work with specific types of content. Every project is reviewed first to make sure it fits our values, standards, and workflow." }
    ]
  },

  /* روابط القائمة (الإنجليزية) — الأعمال / المراحل / الشروط */
  nav: { work: "Work", process: "Process", guidelines: "Guidelines" },

  /* ===== الترجمات ===== */
  i18n: {
    ar: {
      bookACallText: "احجز مكالمة",
      nav: { work: "الأعمال", process: "المراحل", guidelines: "الشروط" },
      hero: {
        line1: "اجعل محتواك يبدو",
        line2: "بمستوى",
        line3: "خبرتك",
        subtitle: "نحوّل خبرتك إلى فيديوهات جاهزة للنشر تعزّز مكانتك، وتساعدك على جذب عملاء محتملين"
      },
      workLabel: "أعمالنا",
      workTitle: "أفضل أعمالنا",
      closing: {
        titlePlain: "ماذا تنتظر",
        titleAccent: "بعد؟",
        line1: "رأيت العمل. تعرف ما هو ممكن.",
        line2: "السؤال الوحيد: هل أنت مستعد للتحرّك؟ 👇"
      },
      process: {
        label: "المراحل",
        title: "طريقة العمل",
        subtitle: "نظام بسيط نفهم فيه مشروعك، نبني لك ستايل مونتاج خاص، ثم نحسّن المحتوى مع الوقت.",
        steps: [
          { title: "نستلم معلومات المشروع", desc: "نستلم منك أهم التفاصيل عن البيزنس، العرض، الجمهور، الريفرنس، واتجاه البراند." },
          { title: "Unique Editing Style", desc: "نبني لك ستايل مونتاج خاص يعكس البراند، الخبرة، وطريقة ظهورك أمام الجمهور." },
          { title: "التسليم والتحليل", desc: "نسلّم الفيديوهات جاهزة للنشر، ونراجع ما الذي يعمل بشكل أفضل لتحسين المحتوى القادم." }
        ]
      },
      guidelines: {
        label: "الشروط",
        title: "معايير العمل",
        subtitle: "نعمل مع عملاء مختارين فقط، حسب نوع المحتوى ومدى توافقه مع قيمنا ومعايير العمل لدينا.",
        steps: [
          { title: "بدون موسيقى", desc: "لا نستخدم الموسيقى في المونتاج. نعتمد على المؤثرات الصوتية، وطريقة عرض بصرية احترافية." },
          { title: "بدون صور للنساء", desc: "لا نضع صورًا أو مشاهد للنساء داخل الفيديوهات التي ننتجها، كما أننا لا نعمل مع النساء." },
          { title: "نختار المحتوى بعناية", desc: "لا نقبل كل المشاريع. نراجع نوع المحتوى أولًا للتأكد من توافقه مع قيمنا، معاييرنا، وطريقة عملنا." }
        ]
      }
    },
    darija: {
      bookACallText: "7jez Mokalma",
      nav: { work: "Lkhedma", process: "Process", guidelines: "Shorot" },
      hero: {
        line1: "Khelli Content Dyalek Yban",
        line2: "B Niveau Dyal",
        line3: "Expertise Dyalek",
        subtitle: "Kan7awlo expertise dyalek l videos wajdin l nnachr, kaybniw trust w authority w kay3awnok tjbed leads."
      },
      workLabel: "Lkhedma dyalna",
      workTitle: "Chof lkhedma dyalna",
      closing: {
        titlePlain: "3lach katsanna",
        titleAccent: "?",
        line1: "Chefti lkhedma. 3arf chno mumkin.",
        line2: "Bqa ghir so2al: wach rak msta3d ttharrek? 👇"
      },
      process: {
        label: "Workflow",
        title: "Process Dyal l Khedma",
        subtitle: "Workflow bsit kankhedmo bih bach nfehmo project dyalek, nbniw lik unique editing style, w ntawro content m3a lwe9t.",
        steps: [
          { title: "Kanstelmo Details", desc: "Kanstelmo mennek l infos l mohimma 3la business, offer, audience, references, w Kifach baghi tban." },
          { title: "Unique Editing Style", desc: "Kanbniw lik editing style khass bik, kaybin brand dyalek, expertise, w authority." },
          { title: "Delivery & Analysis", desc: "Kanselmo videos wajdin l nnachr, w kanchofo chno khdem mzyan bach ntawro content jay." }
        ]
      },
      guidelines: {
        label: "Shorot",
        title: "Ma3ayir lkhadma",
        subtitle: "Kan khdmou ghir m3a clients li mnassbin lina, 7sab no3 dyal lcontent w wach kaytawaf9 m3a l9iyam w ma3ayir lkhadma dyalna.",
        steps: [
          { title: "Bla music", desc: "Ma kansta3mlouch music f montage. Kan3tmdo 3la sound design, clarity, pacing, w visual presentation." },
          { title: "Bla tsawr dyal nssa", desc: "Ma kandiroch tsawr wla machahid dyal nssa dakhel videos li kan ntajo, w ma kan khdmouch m3a nssa." },
          { title: "Kan khtaro lcontent b 3inaya", desc: "Ma kan9blouch kolchi projects. Kan reviewiw no3 dyal lcontent lwel bach nt2akdo bli kaytawaf9 m3a l9iyam dyalna, ma3ayirna, w tari9a dyal lkhadma." }
        ]
      }
    }
  }
};
