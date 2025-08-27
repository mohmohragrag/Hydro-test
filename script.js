// تحويلات
function mmToM(x) { return x / 1000.0; }
function MPaToPa(x) { return x * 1e6; }
function PaToBar(x) { return x / 1e5; }

function roundSmart(x) {
  if (!isFinite(x)) return "—";
  if (x === 0) return "0";
  const absx = Math.abs(x);
  if (absx >= 100) return x.toFixed(1);
  if (absx >= 10)  return x.toFixed(2);
  if (absx >= 1)   return x.toFixed(3);
  if (absx >= 0.1) return x.toFixed(4);
  return x.toFixed(5);
}

// خرائط ومراجع
const yieldMap = { 'ST37': 235, 'ST44': 275, 'ST52': 355 };

// عناصر DOM
const steelTypeEl = document.getElementById('steelType');
const safetyFactorEl = document.getElementById('safetyFactor');
const sigmaAllowEl = document.getElementById('sigmaAllow');
const hydroCheckEl = document.getElementById('hydroCheck');
const hydroOptionsEl = document.getElementById('hydroOptions');
const hydroFactorEl = document.getElementById('hydroFactor');

const fillExampleBtn = document.getElementById('fillExample');

// تحدث σ_allow تلقائياً لو اختار نوع الصلب أو معامل الأمان
function updateSigmaFromSteel() {
  const st = steelTypeEl.value;
  const sf = parseFloat(safetyFactorEl.value || "2");
  if (st in yieldMap) {
    const sy = yieldMap[st];
    sigmaAllowEl.value = (sy / sf).toFixed(2);
  }
}
steelTypeEl.addEventListener('change', updateSigmaFromSteel);
safetyFactorEl.addEventListener('change', updateSigmaFromSteel);

hydroCheckEl.addEventListener('change', function(){
  hydroOptionsEl.classList.toggle('hidden', !hydroCheckEl.checked);
});

// زر المثال الجاهز
fillExampleBtn.addEventListener('click', function(){
  document.getElementById('diameter').value = 200;
  document.getElementById('thickness').value = 20;
  document.getElementById('diameterType').value = 'OD';
  steelTypeEl.value = 'ST52';
  safetyFactorEl.value = '2';
  updateSigmaFromSteel();
  // ارسل الفورم لحساب النتيجة
  document.getElementById('pipeForm').dispatchEvent(new Event('submit', {cancelable: true, bubbles: true}));
});

// معالجة الفورم
document.getElementById('pipeForm').addEventListener('submit', function(e){
  e.preventDefault();

  const D_in = parseFloat(document.getElementById('diameter').value);
  const t_mm = parseFloat(document.getElementById('thickness').value);
  const diaType = document.getElementById('diameterType').value;
  let sigmaAllow_MPa = parseFloat(sigmaAllowEl.value || "120");

  if (!(D_in > 0) || !(t_mm > 0) || !(sigmaAllow_MPa > 0)) {
    alert('ادخل قيم صحيحة أكبر من صفر.');
    return;
  }

  // إذا القطر المدخل ID نعدله إلى OD
  let D_out_mm = D_in;
  if (diaType === 'ID') D_out_mm = D_in + 2 * t_mm;

  // فحص منطقى
  if (t_mm * 2 >= D_out_mm) {
    alert('السُمك كبير جداً: 2t ≥ D الخارجي. راجع القيم.');
    return;
  }

  // تحويل للوحدات SI (متر)
  const D_m = mmToM(D_out_mm);
  const t_m = mmToM(t_mm);

  // نسبة t/D (مبنية على D الخارجي) لتحديد المعادلة
  const t_over_D = t_m / D_m;
  const thinCriterion = 0.1;

  const sigmaAllow_Pa = MPaToPa(sigmaAllow_MPa);

  let p_Pa = null;
  let method = '';
  let extraNotes = [];

  if (t_over_D <= thinCriterion) {
    // جدار رقيق
    method = 'جدار رقيق (Thin-wall)';
    // نستخدم D الخارجي في المعادلة التقليدية p = 2 t σ / D
    p_Pa = (2 * t_m * sigmaAllow_Pa) / D_m;
    extraNotes.push(`نسبة t/D = ${roundSmart(t_over_D)} ≤ ${thinCriterion} → استخدمنا معادلة الجدار الرقيق.`);
  } else {
    // جدار سميك — معادلة لاميه (حالة p_o = 0)
    method = 'جدار سميك (Lame, Thick-wall)';
    const r_o = D_m / 2.0;
    const r_i = r_o - t_m;
    // صيغة مغلقة: p = σ_allow * (r_o^2 - r_i^2) / (r_o^2 + r_i^2)
    const ro2 = r_o * r_o;
    const ri2 = r_i * r_i;
    p_Pa = sigmaAllow_Pa * (ro2 - ri2) / (ro2 + ri2);
    extraNotes.push(`نسبة t/D = ${roundSmart(t_over_D)} > ${thinCriterion} → استخدمنا معادلة لاميه للحائط السميك.`);
    extraNotes.push(`r_o = ${roundSmart(r_o)} m, r_i = ${roundSmart(r_i)} m.`);
  }

  // نتائج نهائية
  const p_bar = PaToBar(p_Pa);
  const p_MPa = p_Pa / 1e6;

  document.getElementById('methodUsed').textContent = method;
  document.getElementById('pBar').textContent = roundSmart(p_bar);
  document.getElementById('pMPa').textContent = roundSmart(p_MPa);
  document.getElementById('sigmaUsed').textContent = roundSmart(sigmaAllow_MPa);

  // اظهار ملاحظات
  const extraEl = document.getElementById('extraInfo');
  extraEl.innerHTML = extraNotes.map(n => `• ${n}`).join('<br>');

  // فحص هيدرو
  const hydroResultEl = document.getElementById('hydroResult');
  if (hydroCheckEl.checked) {
    const hydroFactor = parseFloat(hydroFactorEl.value || "1.5");
    if (!(hydroFactor > 0)) { alert('مضاعف الهيدرو يجب أن يكون أكبر من صفر'); return; }
    const test_p_Pa = p_Pa * hydroFactor;
    const test_p_bar = PaToBar(test_p_Pa);
    const test_p_MPa = test_p_Pa / 1e6;
    hydroResultEl.classList.remove('hidden');
    hydroResultEl.innerHTML = `<strong>فحص هيدروستاتيكي (${hydroFactor}×):</strong> ${roundSmart(test_p_bar)} بار (${roundSmart(test_p_MPa)} MPa).`;
  } else {
    hydroResultEl.classList.add('hidden');
  }

  document.getElementById('result').classList.remove('hidden');
});

// زر المسح
document.getElementById('resetBtn').addEventListener('click', function(){
  document.getElementById('pipeForm').reset();
  document.getElementById('result').classList.add('hidden');
  document.getElementById('hydroOptions').classList.add('hidden');
});

// تهيئة أولية
updateSigmaFromSteel();
