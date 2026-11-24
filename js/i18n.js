// Every label in both languages. Arabic (Modern Standard Arabic) is the default.
// t('key', a, b) fills {0}, {1}…; plural('key', n) picks the Arabic/English plural form.

const LANG_KEY = 'fha.lang';

const ar = {
  app_name: 'منظّم صحة البيت',
  demo: 'تجريبي',
  loading: 'جارٍ التحميل…',
  save: 'حفظ', cancel: 'إلغاء', delete: 'حذف', edit: 'تعديل', back: 'رجوع', add: 'إضافة',
  yes: 'نعم', no: 'لا', close: 'إغلاق', confirm: 'تأكيد', search: 'بحث…', all: 'الكل',
  saved: 'تم الحفظ', deleted: 'تم الحذف', error_generic: 'حدثت مشكلة. حاول مرة أخرى.',
  not_allowed: 'غير مسموح لك بهذا الإجراء.',

  // Tabs
  tab_today: 'اليوم', tab_meds: 'الأدوية', tab_pharmacy: 'الصيدلية', tab_family: 'العائلة', tab_settings: 'الإعدادات',

  // Disclaimer
  disclaimer_title: 'قبل أن تبدأ',
  disclaimer_body: 'يساعدك هذا التطبيق على تنظيم أدوية العائلة ومواعيدها فقط. وهو ليس جهازًا طبيًا ولا بديلًا عن الطبيب أو الصيدلي: لا يشخّص، ولا يحدد الجرعات، ولا ينصح ببدء أي دواء أو إيقافه أو تغييره.\n\nتُقفل بيانات العائلة بـ«مفتاح العائلة» على هاتفك قبل إرسالها، ويحفظها الخادم مقفلة ولا يستطيع قراءتها. إذا ضاع المفتاح من جميع الأجهزة فلا يمكن استعادة البيانات.\n\nيعمل التذكير ما دام التطبيق مفتوحًا فقط، فلا تعتمد عليه وحده.\n\nفي حالات الطوارئ اتصل بالإسعاف على الرقم 123 فورًا.',
  disclaimer_check: 'قرأت ما سبق وأوافق عليه',
  disclaimer_ok: 'أوافق، لنبدأ',

  // Auth
  auth_title: 'تسجيل الدخول',
  auth_signup_title: 'إنشاء حساب جديد',
  email: 'البريد الإلكتروني', password: 'كلمة المرور', your_name: 'اسمك (يظهر لأفراد العائلة)',
  sign_in: 'دخول', sign_up: 'إنشاء الحساب', sign_out: 'تسجيل الخروج',
  have_account: 'لديّ حساب', no_account: 'ليس لديّ حساب',
  forgot: 'نسيت كلمة المرور', reset_sent: 'أرسلنا إليك بريدًا فيه رابط لتغيير كلمة المرور.',
  check_email: 'أرسلنا إليك بريدًا للتأكيد. افتحه ثم سجّل الدخول.',
  new_password: 'كلمة مرور جديدة', set_password: 'تغيير كلمة المرور', password_changed: 'تم تغيير كلمة المرور',
  password_short: 'كلمة المرور 8 أحرف على الأقل',
  email_invalid: 'اكتب بريدًا إلكترونيًا صحيحًا',

  // Onboarding
  onboard_title: 'أهلًا بك',
  onboard_body: 'أنشئ منزلًا جديدًا لعائلتك، أو انضم إلى منزل موجود بالرمز الذي لديك.',
  create_house: 'إنشاء منزل جديد', join_house: 'الانضمام برمز',
  house_name: 'اسم المنزل', house_name_hint: 'المنزل',
  house_name_help: 'اختر اسمًا لا يكشف هوية العائلة (مثل «المنزل»): فهذا الاسم وحده ما يستطيع الخادم قراءته.',
  join_code: 'رمز الانضمام (6 خانات)', join_code_invalid: 'الرمز 6 حروف وأرقام',
  join_sent: 'أُرسل طلبك. انتظر موافقة مالك المنزل.',
  join_not_found: 'هذا الرمز غير موجود. تأكد منه.',
  waiting_title: 'في انتظار الموافقة',
  waiting_body: 'وصل طلبك إلى «{0}». ستتمكن من الدخول فور موافقة مالك المنزل.',
  refresh: 'تحديث',

  // Family key
  key_title: 'مفتاح العائلة',
  key_new_body: 'هذا المفتاح يقفل بيانات العائلة. احفظه على ورقة أو في مكان آمن، وأرسله بنفسك إلى كل فرد ينضم إلى المنزل. إذا ضاع من جميع الأجهزة فلا يمكن استعادة البيانات، ولا نستطيع نحن استعادتها.',
  key_copy: 'نسخ المفتاح', key_copied: 'تم النسخ',
  key_saved_check: 'حفظت المفتاح في مكان آمن',
  key_continue: 'متابعة',
  key_enter_title: 'أدخل مفتاح العائلة',
  key_enter_body: 'المفتاح لدى مالك المنزل (52 حرفًا ورقمًا). اكتبه مرة واحدة على هذا الجهاز.',
  key_wrong: 'هذا المفتاح غير صحيح. تحقق من كل حرف.',
  key_no_have: 'ليس لديّ المفتاح: اطلبه من مالك المنزل.',
  key_show: 'عرض مفتاح العائلة', key_show_confirm: 'هذا المفتاح يفتح جميع بيانات العائلة. لا تُطلع عليه أحدًا من خارج المنزل.',

  // Header / households
  switch_house: 'المنزل', manage_house: 'إدارة المنزل',

  // Roles
  role_owner: 'مالك المنزل', role_admin: 'مشرف', role_caregiver: 'مقدّم رعاية',
  role_patient: 'مريض', role_viewer: 'للاطلاع فقط',
  status_pending: 'في انتظار الموافقة', status_active: 'نشط', status_removed: 'أُزيل',

  // Today
  today_now: 'الآن', today_missed: 'فات موعدها', today_later: 'لاحقًا', today_done: 'تمّت',
  today_as_needed: 'عند الحاجة',
  today_empty_title: 'لا توجد أدوية بعد', today_empty_body: 'أضف أفراد العائلة وأدويتهم، وستظهر هنا مواعيد اليوم.',
  today_all_clear: 'لا شيء مطلوب الآن', today_next_at: 'الجرعة التالية في الساعة {0}.', today_none_left: 'انتهت جرعات اليوم.',
  took_it: 'تم أخذها', skip_it: 'تخطّي الجرعة', undo: 'تراجع', took_now: 'أُخذت جرعة الآن',
  logged_taken: 'سُجّل: {0} أخذ {1}', logged_skipped: 'سُجّل تخطّي {1} لـ{0}',
  status_taken_at: 'أُخذت في الساعة {0}', status_skipped: 'تم تخطّيها',
  missed_note: 'لا تأخذ جرعتين معًا دون سؤال الطبيب.',
  notify_title: 'موعد دواء: {0}',
  reminders_note: 'يعمل التذكير ما دام التطبيق مفتوحًا فقط.',
  enable_notifications: 'تفعيل تنبيهات الهاتف', notifications_on: 'التنبيهات مفعّلة ما دام التطبيق مفتوحًا',

  // Medicines
  meds_empty_title: 'لا توجد أدوية', meds_empty_body: 'أضف أول دواء لأحد أفراد العائلة.',
  add_med: 'إضافة دواء', edit_med: 'تعديل الدواء', med_for: 'لمن هذا الدواء؟',
  med_name: 'اسم الدواء (كما هو مكتوب على العلبة)', med_name_hint: 'Concor', med_name_required: 'اكتب اسم الدواء',
  med_strength: 'التركيز (إن كان مكتوبًا)', med_strength_hint: '5 mg',
  med_form: 'الشكل الدوائي', med_dose: 'الكمية في كل مرة', dose_other: 'كمية أخرى', dose_invalid: 'اكتب الكمية',
  med_how_often: 'عدد المرات', freq_1: 'مرة واحدة يوميًا', freq_2: 'مرتين يوميًا', freq_3: '3 مرات يوميًا',
  freq_4: '4 مرات يوميًا', freq_every: 'كل عدة أيام', freq_needed: 'عند الحاجة',
  every_n: 'كل كم يومًا؟', every_n_invalid: 'اكتب عدد الأيام (2 أو أكثر)',
  med_food: 'علاقته بالطعام', food_before: 'قبل الأكل', food_after: 'بعد الأكل', food_with: 'مع الأكل', food_none: 'لا يهم',
  med_times: 'المواعيد', med_times_help: 'اقتُرحت المواعيد بحسب مواعيد وجبات الشخص. عدّلها إن لزم.',
  med_how_long: 'المدة', forever: 'مستمر', for_days: 'عدد أيام محدد', days_count: 'كم يومًا؟', days_invalid: 'اكتب عدد الأيام',
  med_start: 'يبدأ في', med_person_required: 'اختر الشخص',
  med_stop: 'إيقاف الدواء', med_resume: 'استئناف الدواء', med_stopped: 'متوقف',
  med_stop_confirm: 'إيقاف {0}؟ لن يظهر في مواعيد اليوم بعد الآن.',
  med_delete_confirm: 'حذف {0}؟ سيُزال من القائمة ومن المواعيد.',
  sort_name: 'حسب الاسم', sort_person: 'حسب الشخص', filter_person: 'كل العائلة', show_stopped: 'إظهار المتوقف',
  no_results: 'لا توجد نتائج.',

  // Forms
  form_TABLET: 'أقراص', form_CAPSULE: 'كبسولات', form_SYRUP: 'شراب', form_DROPS: 'قطرات',
  form_INJECTION: 'حقن', form_CREAM: 'كريم أو مرهم', form_SPRAY: 'بخاخ',

  // Pharmacy (home stock)
  pharmacy_title: 'صيدلية المنزل',
  pharmacy_intro: 'سجّل الأدوية الموجودة في المنزل وكمياتها، فإذا وصف لك الطبيب دواءً أو كنت في الصيدلية عرفت هل هو عندك فلا تشتريه مرة أخرى.',
  pharmacy_search: 'هل الدواء موجود في المنزل؟', pharmacy_search_hint: 'اكتب اسم الدواء…',
  pharmacy_found: 'موجود في المنزل',
  pharmacy_not_found: 'غير موجود في صيدلية المنزل',
  pharmacy_not_found_hint: 'تأكد من كتابة الاسم كما هو على العلبة.',
  pharmacy_empty_title: 'الصيدلية فارغة',
  pharmacy_ask_note: 'لا تستبدل دواءً بآخر إلا بعد سؤال الطبيب أو الصيدلي.',
  add_stock: 'إضافة دواء إلى الصيدلية', edit_stock: 'تعديل بيانات العلبة', add_this_to_stock: 'إضافته إلى الصيدلية',
  stock_count: 'الكمية الموجودة', stock_count_units: 'عدد {0} الموجودة فعلًا', stock_count_packs: 'عدد العبوات الموجودة',
  stock_count_invalid: 'اكتب الكمية بالأرقام',
  stock_expiry: 'تاريخ انتهاء الصلاحية (الشهر والسنة)', stock_expiry_invalid: 'اختر الشهر والسنة',
  stock_note: 'ملاحظة (مثل مكان الحفظ)',
  stock_left: 'المتبقي: {0}', stock_lasts: 'يكفي نحو {0}', stock_expires: 'تنتهي صلاحيته في {0}', stock_no_expiry: 'تاريخ الانتهاء غير مسجّل',
  stock_used_by: 'يستخدمه: {0}', stock_not_used: 'لا يستخدمه أحد حاليًا',
  stock_boxes: 'العلب', stock_update_count: 'تعديل الكمية', stock_new_count: 'الكمية الموجودة الآن',
  stock_delete: 'إزالة من الصيدلية', stock_delete_confirm: 'إزالة {0} من الصيدلية؟',
  stock_auto_note: 'تُخصم الجرعات المأخوذة من الكمية تلقائيًا، من العلبة الأقرب انتهاءً أولًا.',
  tag_low: 'قارب على النفاد', tag_out: 'نفد', tag_expiring: 'تنتهي صلاحيته قريبًا', tag_expired: 'منتهي الصلاحية',
  filter_low: 'ناقص', filter_expiring: 'قريب الانتهاء', filter_expired: 'منتهي',
  shopping_share: 'مشاركة قائمة النواقص', shopping_title: 'أدوية ناقصة في المنزل:', shopping_empty: 'لا توجد نواقص الآن.',
  med_in_stock: 'في صيدلية المنزل: {0}', med_not_in_stock: 'غير موجود في صيدلية المنزل.',
  today_stock_banner: 'في الصيدلية ما يحتاج إلى انتباه: {0}', open_pharmacy: 'فتح الصيدلية',
  export_stock_csv: 'تصدير الصيدلية (CSV)',

  // Appointments
  appts_title: 'المواعيد', appts_upcoming: 'المواعيد القادمة', appts_past: 'مواعيد سابقة',
  appts_empty_title: 'لا توجد مواعيد', appts_empty_body: 'أضف مواعيد الأطباء والتحاليل حتى لا يفوتك أحدها.',
  add_appt: 'إضافة موعد', new_appt: 'موعد جديد', edit_appt: 'تعديل الموعد',
  appt_for: 'لمن الموعد؟', appt_person_required: 'اختر الشخص',
  appt_name: 'الطبيب أو الجهة', appt_name_hint: 'د. سامي (القلب)، معمل التحاليل…', appt_name_required: 'اكتب اسم الطبيب أو الجهة',
  appt_date: 'التاريخ', appt_time: 'الساعة', appt_when_required: 'اختر التاريخ والساعة',
  appt_place: 'المكان', appt_place_hint: 'اسم المستشفى أو العنوان',
  appt_note: 'ملاحظات', appt_note_hint: 'أسئلة للطبيب، أو أوراق تأخذها معك',
  appt_delete_confirm: 'حذف هذا الموعد؟',
  day_today: 'اليوم', day_tomorrow: 'غدًا', appt_in: 'بعد {0}', appt_done: 'انتهى',
  appt_calendar: 'إضافة إلى تقويم الهاتف',
  appt_calendar_hint: 'يذكّرك تقويم الهاتف قبل الموعد بيوم وقبله بساعتين، حتى لو كان التطبيق مغلقًا.',
  appt_calendar_title: 'موعد {0}: {1}',
  today_appts: 'مواعيد قريبة', notify_appt: 'موعد قريب: {0}',
  all_appts: 'جميع المواعيد', person_appts: 'المواعيد', no_appts: 'لا توجد مواعيد قادمة.',
  kind_appointment: 'موعدًا',

  // Emergency
  sos: 'طوارئ', emergency_title: 'بطاقات الطوارئ', emergency_pick: 'اختر الشخص لعرض بطاقته.',
  emergency_card: 'بطاقة الطوارئ', call_ambulance: 'اتصال بالإسعاف (123)', call_contact: 'اتصال بـ {0}',
  em_age: 'العمر', em_blood: 'فصيلة الدم', em_allergies: 'الحساسية', em_no_allergies: 'لا توجد حساسية مسجّلة',
  em_conditions: 'الأمراض المزمنة', em_meds: 'الأدوية الحالية', em_no_meds: 'لا توجد أدوية حالية',
  em_contact: 'شخص للطوارئ', em_share: 'مشاركة البطاقة', em_copied: 'تم نسخ البطاقة',
  em_offline: 'لا يوجد اتصال بالإنترنت. هذه آخر نسخة حُفظت على هذا الهاتف ({0}).',
  em_saved_note: 'تُحفظ هذه البطاقات على هذا الهاتف مقفلة بمفتاح العائلة، لتُفتح بدون إنترنت.',
  em_none: 'لا توجد بطاقات محفوظة على هذا الهاتف.',
  offline_title: 'لا يوجد اتصال بالإنترنت', offline_body: 'يحتاج التطبيق إلى الإنترنت، أما بطاقات الطوارئ فتُفتح بدونه.',
  open_emergency: 'فتح بطاقات الطوارئ', retry: 'إعادة المحاولة',

  // Family
  family_empty_title: 'ابدأ بأفراد العائلة', family_empty_body: 'أضف كل من يتناول أدوية في المنزل. يكفي الاسم.',
  add_person: 'إضافة فرد من العائلة', edit_person: 'تعديل البيانات', new_person: 'فرد جديد',
  person_name: 'الاسم', person_name_hint: 'الأم، الأب، أحمد…', person_name_required: 'اكتب الاسم',
  birth_year: 'سنة الميلاد', birth_year_invalid: 'اكتب السنة بالأرقام، مثل 1965',
  blood_type: 'فصيلة الدم', unknown: 'غير معروفة',
  allergies: 'الحساسية', allergies_hint: 'بنسلين، أسبرين… (افصل بينها بفاصلة)',
  conditions: 'الأمراض المزمنة', conditions_hint: 'ضغط الدم، السكري… (افصل بينها بفاصلة)',
  contact_name: 'اسم شخص للطوارئ', contact_phone: 'رقم هاتفه', phone_invalid: 'رقم الهاتف 11 رقمًا ويبدأ بـ 01',
  meals: 'مواعيد الوجبات', meals_help: 'تُستخدم لأدوية ما قبل الأكل وما بعده.',
  breakfast: 'الإفطار', lunch: 'الغداء', dinner: 'العشاء',
  age_years: '{0} سنة', blood: 'فصيلة الدم: {0}', allergy_line: 'الحساسية: {0}', conditions_line: 'الأمراض المزمنة: {0}',
  person_meds: 'الأدوية', person_delete_confirm: 'حذف {0}؟ ستُحذف أدوية {0} أيضًا.',
  none: 'لا يوجد',

  // Settings
  settings_lang: 'اللغة', lang_ar: 'العربية', lang_en: 'English',
  settings_data: 'البيانات', backup: 'حفظ نسخة احتياطية (ملف)', restore: 'الاستعادة من نسخة احتياطية',
  backup_hint: 'ملف النسخة الاحتياطية غير مقفل بمفتاح العائلة، فمن يحصل عليه يستطيع قراءته. احفظه في مكان آمن.',
  restore_confirm: 'استعادة البيانات من هذا الملف؟ ستحل محتويات الملف محل نظيراتها في المنزل.',
  restored: 'تمت استعادة {0} عنصر', restore_bad: 'هذا الملف ليس نسخة احتياطية من التطبيق.',
  export_meds_csv: 'تصدير الأدوية (CSV)', export_doses_csv: 'تصدير الجرعات (CSV)',
  settings_account: 'الحساب', signed_in_as: 'مسجّل الدخول باسم {0}',
  leave_house: 'مغادرة المنزل', leave_confirm: 'مغادرة «{0}»؟ لن ترى بياناته بعد ذلك.',
  demo_role: 'العرض بصفة…', demo_role_help: 'في النسخة التجريبية فقط: شاهد التطبيق كما يراه كل دور.',
  demo_reset: 'إعادة البيانات التجريبية', demo_reset_confirm: 'إعادة البيانات التجريبية إلى حالتها الأولى؟',
  about: 'عن التطبيق', about_body: 'منظّم صحة البيت: نسخة تجريبية. تُقفل البيانات بمفتاح العائلة قبل إرسالها.',
  owner_page: 'لوحة مالك المنصة',
  update_ready: 'يتوفر إصدار جديد', reload: 'تحديث',

  // Admin
  admin_title: 'إدارة المنزل', members: 'الأفراد', pending: 'في انتظار الموافقة',
  approve: 'موافقة', reject: 'رفض', remove: 'إزالة', change_role: 'تغيير الدور',
  approve_as: 'الموافقة على {0} بصفة', link_person: 'لأي فرد من العائلة هذا الحساب؟',
  approve_need_person: 'اختر الشخص المرتبط بحساب المريض',
  remove_confirm: 'إزالة {0} من المنزل؟', reject_confirm: 'رفض طلب {0}؟',
  join_code_title: 'رمز الانضمام', new_join_code: 'رمز جديد', new_code_confirm: 'إنشاء رمز جديد؟ سيتوقف الرمز القديم عن العمل.',
  share_invite: 'إرسال الدعوة', invite_text: 'انضم إلى «{0}» في تطبيق منظّم صحة البيت بالرمز {1}: {2}',
  rename_house: 'تغيير اسم المنزل', activity: 'السجل', activity_empty: 'لا يوجد شيء في السجل بعد.',
  export_json: 'تصدير جميع البيانات (JSON)',
  transfer_owner: 'نقل الملكية', transfer_confirm: 'نقل ملكية المنزل إلى {0}؟ ستصبح مشرفًا.',
  delete_house: 'حذف المنزل', delete_house_confirm: 'حذف المنزل وجميع بياناته نهائيًا؟ اكتب اسم المنزل للتأكيد.',
  you: '(أنت)',
  act_insert: 'أضاف', act_update: 'عدّل', act_delete: 'حذف', act_member: 'الأفراد',
  ev_group_created: 'أنشأ المنزل', ev_member_approved: 'وافق على', ev_member_rejected: 'رفض',
  ev_member_removed: 'أزال', ev_role_changed: 'غيّر دور', ev_group_renamed: 'غيّر اسم المنزل',
  ev_join_code_changed: 'أنشأ رمز انضمام جديدًا', ev_member_left: 'غادر المنزل', ev_ownership_transferred: 'نقل الملكية إلى',
  kind_person: 'فردًا', kind_medicine: 'دواءً', kind_dose_log: 'جرعة', kind_stock: 'علبة في الصيدلية',

  // Owner page
  owner_title: 'لوحة مالك المنصة', owner_only: 'هذه الصفحة لمالكي المنصة فقط.',
  stat_groups: 'المنازل', stat_users: 'المستخدمون', stat_week: 'نشاط الأسبوع',
  owner_search: 'البحث عن منزل', disable: 'إيقاف', enable: 'تفعيل', disabled: 'متوقف',
  disable_confirm: 'إيقاف «{0}»؟ لن يتمكن أفراده من فتحه.',
  owner_privacy: 'تعرض هذه اللوحة أعداد المنازل وأسماءها فقط. أما البيانات الصحية فمقفلة ولا يطّلع عليها إلا أفراد العائلة.',
  members_count: 'الأفراد: {0}', records_count: 'السجلات: {0}',
  another_house: 'منزل آخر (جديد أو برمز)',
};

const en = {
  app_name: 'Family Health Assistant',
  demo: 'Demo',
  loading: 'Loading…',
  save: 'Save', cancel: 'Cancel', delete: 'Delete', edit: 'Edit', back: 'Back', add: 'Add',
  yes: 'Yes', no: 'No', close: 'Close', confirm: 'Confirm', search: 'Search…', all: 'All',
  saved: 'Saved', deleted: 'Deleted', error_generic: 'Something went wrong. Try again.',
  not_allowed: "You're not allowed to do that.",

  tab_today: 'Today', tab_meds: 'Medicines', tab_family: 'Family', tab_settings: 'Settings',
  tab_pharmacy: 'Pharmacy',
  pharmacy_title: 'Home pharmacy',
  pharmacy_intro: "Record the medicines you have at home and how much is left. When a doctor prescribes something or you're at the pharmacy, you'll know whether you already have it.",
  pharmacy_search: 'Is this medicine at home?', pharmacy_search_hint: 'Type the medicine name…',
  pharmacy_found: 'At home', pharmacy_not_found: 'Not in the home pharmacy',
  pharmacy_not_found_hint: 'Check the name is spelled as on the box.',
  pharmacy_empty_title: 'The pharmacy is empty',
  pharmacy_ask_note: "Don't swap one medicine for another without asking the doctor or pharmacist.",
  add_stock: 'Add to the pharmacy', edit_stock: 'Edit this box', add_this_to_stock: 'Add it to the pharmacy',
  stock_count: 'Amount at home', stock_count_units: 'Number of {0} actually there', stock_count_packs: 'Number of packs',
  stock_count_invalid: 'Enter the amount in digits',
  stock_expiry: 'Expiry (month and year)', stock_expiry_invalid: 'Choose the month and year',
  stock_note: 'Note (e.g. where it is kept)',
  stock_left: 'Left: {0}', stock_lasts: 'Lasts about {0}', stock_expires: 'Expires {0}', stock_no_expiry: 'No expiry recorded',
  stock_used_by: 'Used by: {0}', stock_not_used: 'Nobody takes it now',
  stock_boxes: 'Boxes', stock_update_count: 'Update amount', stock_new_count: 'Amount there now',
  stock_delete: 'Remove from pharmacy', stock_delete_confirm: 'Remove {0} from the pharmacy?',
  stock_auto_note: 'Taken doses are subtracted automatically, from the box that expires first.',
  tag_low: 'Running low', tag_out: 'Out', tag_expiring: 'Expires soon', tag_expired: 'Expired',
  filter_low: 'Low', filter_expiring: 'Expiring', filter_expired: 'Expired',
  shopping_share: 'Share shopping list', shopping_title: 'Medicines running low at home:', shopping_empty: 'Nothing is running low.',
  med_in_stock: 'In the home pharmacy: {0}', med_not_in_stock: 'Not in the home pharmacy.',
  today_stock_banner: 'The pharmacy needs attention: {0}', open_pharmacy: 'Open pharmacy',
  export_stock_csv: 'Export pharmacy (CSV)', kind_stock: 'pharmacy box',

  disclaimer_title: 'Before you start',
  disclaimer_body: "This app only helps you organize your family's medicines and schedules. It is not a medical device and doesn't replace a doctor or pharmacist: it doesn't diagnose, set doses, or tell anyone to start, stop or change a medicine.\n\nYour family's data is locked with the family key on your phone before it is sent; the server keeps it locked and can't read it. If the key is lost on every device, the data can't be recovered.\n\nReminders only work while the app is open, so don't rely on them alone.\n\nIn an emergency call an ambulance (123 in Egypt) right away.",
  disclaimer_check: "I've read this and agree",
  disclaimer_ok: "Agree and start",

  auth_title: 'Sign in', auth_signup_title: 'Create an account',
  email: 'Email', password: 'Password', your_name: 'Your name (shown to the family)',
  sign_in: 'Sign in', sign_up: 'Create account', sign_out: 'Sign out',
  have_account: 'I have an account', no_account: "I don't have an account",
  forgot: 'Forgot password', reset_sent: 'We sent you an email with a link to change your password.',
  check_email: 'We sent you a confirmation email. Open it, then sign in.',
  new_password: 'New password', set_password: 'Change password', password_changed: 'Password changed',
  password_short: 'At least 8 characters', email_invalid: 'Enter a valid email',

  onboard_title: 'Welcome',
  onboard_body: 'Start a new household for your family, or join one with the code you were given.',
  create_house: 'Start a new household', join_house: 'Join with a code',
  house_name: 'Household name', house_name_hint: 'Home',
  house_name_help: "Pick a name that doesn't identify the family (like \"Home\"): it's the only thing the server can read.",
  join_code: 'Join code (6 characters)', join_code_invalid: 'The code is 6 letters and digits',
  join_sent: 'Request sent. Wait for the owner to approve it.', join_not_found: "That code doesn't exist. Check it.",
  waiting_title: 'Waiting for approval',
  waiting_body: 'Your request to "{0}" arrived. As soon as the owner approves, you can come in.',
  refresh: 'Refresh',

  key_title: 'Family key',
  key_new_body: "This key locks your family's data. Write it down or keep it somewhere safe, and send it yourself to everyone who joins. If it's lost on every device, the data can't be recovered — not even by us.",
  key_copy: 'Copy key', key_copied: 'Copied',
  key_saved_check: "I've saved the key somewhere safe", key_continue: 'Continue',
  key_enter_title: 'Enter the family key',
  key_enter_body: 'The owner has the key (52 letters and digits). Type it once on this device.',
  key_wrong: "That key isn't right. Check every character.",
  key_no_have: "I don't have it: ask the household owner.",
  key_show: 'Show family key', key_show_confirm: "This key opens all of the family's data. Don't show it to anyone outside the household.",

  switch_house: 'Household', manage_house: 'Manage household',

  role_owner: 'Owner', role_admin: 'Admin', role_caregiver: 'Caregiver', role_patient: 'Patient', role_viewer: 'Viewer',
  status_pending: 'Waiting', status_active: 'Active', status_removed: 'Removed',

  today_now: 'Now', today_missed: 'Missed', today_later: 'Later', today_done: 'Done', today_as_needed: 'As needed',
  today_empty_title: 'No medicines yet', today_empty_body: "Add your family and their medicines; today's doses show here.",
  today_all_clear: 'Nothing due right now', today_next_at: 'Next dose at {0}.', today_none_left: 'All done for today.',
  took_it: 'Taken', skip_it: 'Skip', undo: 'Undo', took_now: 'Took a dose now',
  logged_taken: 'Logged: {0} took {1}', logged_skipped: 'Logged: {0} skips {1}',
  status_taken_at: 'Taken at {0}', status_skipped: 'Skipped',
  missed_note: "Don't take two doses together without asking the doctor.",
  notify_title: 'Medicine time: {0}',
  reminders_note: 'Reminders only work while the app is open.',
  enable_notifications: 'Turn on phone alerts', notifications_on: 'Alerts are on while the app is open',

  meds_empty_title: 'No medicines', meds_empty_body: 'Add the first medicine for someone in the family.',
  add_med: 'Add medicine', edit_med: 'Edit medicine', med_for: 'Who is it for?',
  med_name: 'Name (as on the box)', med_name_hint: 'Concor', med_name_required: 'Enter the medicine name',
  med_strength: 'Strength (if printed)', med_strength_hint: '5 mg',
  med_form: 'What kind?', med_dose: 'How much each time?', dose_other: 'Other amount', dose_invalid: 'Enter the amount',
  med_how_often: 'How often?', freq_1: 'Once a day', freq_2: 'Twice a day', freq_3: '3 times a day',
  freq_4: '4 times a day', freq_every: 'Every few days', freq_needed: 'As needed',
  every_n: 'Every how many days?', every_n_invalid: 'Enter the number of days (2 or more)',
  med_food: 'With food?', food_before: 'Before food', food_after: 'After food', food_with: 'With food', food_none: "Doesn't matter",
  med_times: 'Times', med_times_help: "Times follow the person's meal times. Change them if needed.",
  med_how_long: 'How long?', forever: 'Ongoing', for_days: 'Number of days', days_count: 'How many days?', days_invalid: 'Enter the number of days',
  med_start: 'Starts on', med_person_required: 'Choose the person',
  med_stop: 'Stop medicine', med_resume: 'Resume medicine', med_stopped: 'Stopped',
  med_stop_confirm: "Stop {0}? It won't show in today's doses any more.",
  med_delete_confirm: 'Delete {0}? It will be removed from the list and the schedule.',
  sort_name: 'By name', sort_person: 'By person', filter_person: 'Whole family', show_stopped: 'Show stopped',
  no_results: 'No results.',

  form_TABLET: 'Tablets', form_CAPSULE: 'Capsules', form_SYRUP: 'Syrup', form_DROPS: 'Drops',
  form_INJECTION: 'Injections', form_CREAM: 'Cream or ointment', form_SPRAY: 'Spray',

  appts_title: 'Appointments', appts_upcoming: 'Coming up', appts_past: 'Past appointments',
  appts_empty_title: 'No appointments', appts_empty_body: "Add doctor and lab appointments so you don't miss one.",
  add_appt: 'Add appointment', new_appt: 'New appointment', edit_appt: 'Edit appointment',
  appt_for: 'Who is it for?', appt_person_required: 'Choose the person',
  appt_name: 'Doctor or place', appt_name_hint: 'Dr Sami (heart), the lab…', appt_name_required: 'Enter the doctor or place',
  appt_date: 'Date', appt_time: 'Time', appt_when_required: 'Choose the date and time',
  appt_place: 'Where', appt_place_hint: 'Hospital name or address',
  appt_note: 'Notes', appt_note_hint: 'Questions for the doctor, papers to bring',
  appt_delete_confirm: 'Delete this appointment?',
  day_today: 'Today', day_tomorrow: 'Tomorrow', appt_in: 'in {0}', appt_done: 'Past',
  appt_calendar: "Add to the phone's calendar",
  appt_calendar_hint: "The phone's calendar reminds you a day before and 2 hours before, even with the app closed.",
  appt_calendar_title: '{0}: appointment with {1}',
  today_appts: 'Appointments soon', notify_appt: 'Appointment soon: {0}',
  all_appts: 'All appointments', person_appts: 'Appointments', no_appts: 'No appointments coming up.',
  kind_appointment: 'appointment',

  sos: 'Emergency', emergency_title: 'Emergency cards', emergency_pick: 'Choose a person to see their card.',
  emergency_card: 'Emergency card', call_ambulance: 'Call an ambulance (123)', call_contact: 'Call {0}',
  em_age: 'Age', em_blood: 'Blood type', em_allergies: 'Allergies', em_no_allergies: 'No allergies recorded',
  em_conditions: 'Long-term conditions', em_meds: 'Current medicines', em_no_meds: 'No current medicines',
  em_contact: 'Emergency contact', em_share: 'Share the card', em_copied: 'Card copied',
  em_offline: 'No internet connection. This is the last copy saved on this phone ({0}).',
  em_saved_note: 'These cards are saved on this phone, locked with the family key, so they open without internet.',
  em_none: 'No cards are saved on this phone.',
  offline_title: 'No internet connection', offline_body: 'The app needs the internet, but the emergency cards open without it.',
  open_emergency: 'Open emergency cards', retry: 'Try again',

  family_empty_title: 'Start with your family', family_empty_body: 'Add everyone at home who takes medicines. A name is enough.',
  add_person: 'Add a family member', edit_person: 'Edit details', new_person: 'New family member',
  person_name: 'Name', person_name_hint: 'Mum, Dad, Ahmed…', person_name_required: 'Enter the name',
  birth_year: 'Birth year', birth_year_invalid: 'Enter the year in digits, like 1965',
  blood_type: 'Blood type', unknown: "Don't know",
  allergies: 'Allergies', allergies_hint: 'Penicillin, aspirin… (comma separated)',
  conditions: 'Long-term conditions', conditions_hint: 'Blood pressure, diabetes… (comma separated)',
  contact_name: 'Emergency contact name', contact_phone: 'Their number', phone_invalid: 'Mobile numbers are 11 digits starting with 01',
  meals: 'Meal times', meals_help: 'Used for medicines taken before or after food.',
  breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner',
  age_years: '{0} years', blood: 'Blood type: {0}', allergy_line: 'Allergies: {0}', conditions_line: 'Conditions: {0}',
  person_meds: 'Their medicines', person_delete_confirm: 'Delete {0}? Their medicines will be removed too.',
  none: 'None',

  settings_lang: 'Language', lang_ar: 'العربي', lang_en: 'English',
  settings_data: 'Data', backup: 'Save a backup (file)', restore: 'Restore from a backup',
  backup_hint: "The backup file isn't locked with the family key: anyone with the file can read it. Keep it somewhere safe.",
  restore_confirm: 'Restore data from this file? Items in the file replace the same items in this household.',
  restored: '{0} items restored', restore_bad: "That file isn't a backup from this app.",
  export_meds_csv: 'Export medicines (CSV)', export_doses_csv: 'Export doses (CSV)',
  settings_account: 'Account', signed_in_as: 'Signed in as {0}',
  leave_house: 'Leave household', leave_confirm: "Leave \"{0}\"? You won't see its data any more.",
  demo_role: 'View as…', demo_role_help: 'Demo only: see the app as each role.',
  demo_reset: 'Reset demo data', demo_reset_confirm: 'Reset the demo data to the start?',
  about: 'About', about_body: "Family Health Assistant: demo version. Data is locked with the family key before it is sent.",
  owner_page: 'Platform owner panel',
  update_ready: 'New version available', reload: 'Reload',

  admin_title: 'Manage household', members: 'Members', pending: 'Waiting for approval',
  approve: 'Approve', reject: 'Reject', remove: 'Remove', change_role: 'Change role',
  approve_as: 'Approve {0} as', link_person: 'Which family member is this account?',
  approve_need_person: 'Choose the person for a patient',
  remove_confirm: 'Remove {0} from the household?', reject_confirm: "Reject {0}'s request?",
  join_code_title: 'Join code', new_join_code: 'New code', new_code_confirm: 'Make a new code? The old one will stop working.',
  share_invite: 'Share invite', invite_text: 'Join "{0}" on Family Health Assistant with code {1}: {2}',
  rename_house: 'Rename household', activity: 'Activity', activity_empty: 'Nothing in the activity log yet.',
  export_json: 'Export all data (JSON)',
  transfer_owner: 'Transfer ownership', transfer_confirm: "Transfer ownership to {0}? You'll become an admin.",
  delete_house: 'Delete household', delete_house_confirm: 'Delete the household and all its data for good? Type the household name to confirm.',
  you: '(you)',
  act_insert: 'added', act_update: 'changed', act_delete: 'deleted', act_member: 'members',
  ev_group_created: 'created the household', ev_member_approved: 'approved', ev_member_rejected: 'rejected',
  ev_member_removed: 'removed', ev_role_changed: 'changed the role of', ev_group_renamed: 'renamed the household',
  ev_join_code_changed: 'made a new join code', ev_member_left: 'left the household', ev_ownership_transferred: 'transferred ownership to',
  kind_person: 'person', kind_medicine: 'medicine', kind_dose_log: 'dose',

  owner_title: 'Platform owner panel', owner_only: 'This page is for platform owners only.',
  stat_groups: 'Households', stat_users: 'Users', stat_week: 'Activity this week',
  owner_search: 'Search households', disable: 'Disable', enable: 'Enable', disabled: 'Disabled',
  disable_confirm: 'Disable "{0}"? Its members won\'t be able to open it.',
  owner_privacy: 'This panel shows counts and household names only. Health data is locked; only the family can read it.',
  members_count: '{0} members', records_count: '{0} records',
  another_house: 'Another household (new or by code)',
};

const dicts = { ar, en };

export function getLang() {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === 'ar' || saved === 'en') return saved;
  } catch { /* ignore */ }
  return 'ar';
}

export function setLang(lang) {
  try { localStorage.setItem(LANG_KEY, lang); } catch { /* ignore */ }
  applyLang();
}

export function applyLang() {
  const lang = getLang();
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.title = t('app_name');
}

export function t(key, ...args) {
  const lang = getLang();
  let s = dicts[lang][key] ?? dicts.ar[key] ?? key;
  args.forEach((a, i) => { s = s.replaceAll(`{${i}}`, String(a)); });
  return s;
}

/** Keeps Latin text (drug names, doses, times) in its own order inside Arabic text. */
export function ltr(s) {
  return `⁦${s}⁩`;
}

/** Arabic-Indic and Persian digits typed by the user become 0-9. */
export function normalizeDigits(s) {
  return String(s ?? '')
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06F0))
    .replace(/٫/g, '.');
}

// ---- Dose, count and schedule wording (Arabic number agreement) ----

// Arabic counted nouns: 1 → "قرص واحد", 2 → "قرصان", 3–10 → "3 أقراص", 11+ → "11 قرصًا".
const arUnits = {
  TABLET: { one: 'قرص واحد', two: 'قرصان', few: 'أقراص', many: 'قرصًا', unit: 'قرص', half: 'نصف قرص', oneHalf: 'قرص ونصف', plural: 'الأقراص' },
  CAPSULE: { one: 'كبسولة واحدة', two: 'كبسولتان', few: 'كبسولات', many: 'كبسولة', unit: 'كبسولة', half: 'نصف كبسولة', oneHalf: 'كبسولة ونصف', plural: 'الكبسولات' },
  DROPS: { one: 'قطرة واحدة', two: 'قطرتان', few: 'قطرات', many: 'قطرة', unit: 'قطرة', plural: 'القطرات' },
  INJECTION: { one: 'حقنة واحدة', two: 'حقنتان', few: 'حقن', many: 'حقنة', unit: 'حقنة', plural: 'الحقن' },
  SPRAY: { one: 'بخة واحدة', two: 'بختان', few: 'بخات', many: 'بخة', unit: 'بخة', plural: 'البخات' },
  PACK: { one: 'عبوة واحدة', two: 'عبوتان', few: 'عبوات', many: 'عبوة', unit: 'عبوة', plural: 'العبوات' },
  DAY: { one: 'يوم واحد', two: 'يومين', few: 'أيام', many: 'يومًا', unit: 'يوم', plural: 'الأيام' },
};
const enUnits = {
  TABLET: ['tablet', 'tablets'], CAPSULE: ['capsule', 'capsules'], DROPS: ['drop', 'drops'],
  INJECTION: ['injection', 'injections'], SPRAY: ['puff', 'puffs'], PACK: ['pack', 'packs'], DAY: ['day', 'days'],
};

function num(x) {
  return Number.isInteger(x) ? String(x) : String(x).replace(/0+$/, '').replace(/\.$/, '');
}

/** n of a counted thing: "3 أقراص", "قرصان", "12 يومًا" / "3 tablets". kind: a form, 'PACK' or 'DAY'. */
export function countWords(n, kind) {
  if (getLang() === 'en') {
    const [one, many] = enUnits[kind] || enUnits.TABLET;
    return `${num(n)} ${n === 1 ? one : many}`;
  }
  const w = arUnits[kind] || arUnits.TABLET;
  if (n === 0.5 && w.half) return w.half;
  if (n === 1.5 && w.oneHalf) return w.oneHalf;
  if (!Number.isInteger(n) || n === 0) return `${num(n)} ${w.unit}`;
  if (n === 1) return w.one;
  if (n === 2) return w.two;
  if (n >= 3 && n <= 10) return `${n} ${w.few}`;
  return `${n} ${w.many}`;
}

/** Plural name of a countable form, for labels: "الأقراص" / "tablets". */
export function unitPlural(form) {
  if (getLang() === 'en') return (enUnits[form] || enUnits.TABLET)[1];
  return (arUnits[form] || arUnits.TABLET).plural;
}

/** "قرص واحد", "قرصان", "3 أقراص", "نصف قرص", "5 مل", "دهان" / "1 tablet", "5 ml". */
export function doseWords(amount, form) {
  const lang = getLang();
  if (form === 'CREAM') return lang === 'ar' ? 'دهان' : 'apply';
  if (form === 'SYRUP') return lang === 'ar' ? `${num(amount)} مل` : `${num(amount)} ml`;
  return countWords(amount, form);
}

export function timesPerDayWords(n) {
  if (getLang() === 'en') return n === 1 ? 'once a day' : n === 2 ? 'twice a day' : `${n} times a day`;
  if (n === 1) return 'مرة واحدة يوميًا';
  if (n === 2) return 'مرتين يوميًا';
  return n <= 10 ? `${n} مرات يوميًا` : `${n} مرة يوميًا`;
}

export function everyNDaysWords(n) {
  if (getLang() === 'en') return n === 2 ? 'every other day' : `every ${n} days`;
  if (n === 2) return 'كل يومين';
  return n <= 10 ? `كل ${n} أيام` : `كل ${n} يومًا`;
}

export function forDaysWords(n) {
  if (getLang() === 'en') return n === 1 ? 'for 1 day' : `for ${n} days`;
  if (n === 1) return 'ليوم واحد';
  if (n === 2) return 'لمدة يومين';
  return n <= 10 ? `لمدة ${n} أيام` : `لمدة ${n} يومًا`;
}

/** "2027-05" → "05/2027" (digits stay Latin in both languages). */
export function monthYear(ym) {
  const [y, m] = String(ym || '').split('-');
  return y && m ? `${m}/${y}` : '';
}

/** Joins a list with the comma of the current language ("، " or ", "). */
export function joinList(items) {
  return items.join(getLang() === 'ar' ? '، ' : ', ');
}

/** "الخميس، 26 نوفمبر" / "Thursday 26 November" (with the year when it isn't this year). */
export function dateLong(ms) {
  const d = new Date(ms);
  const opts = { weekday: 'long', day: 'numeric', month: 'long' };
  if (d.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric';
  return d.toLocaleDateString(getLang() === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', opts);
}
