const TEMPLATE_VARIABLES = [
  ['observed_time', '观测时间'], ['period', '时段'], ['weather', '天气'],
  ['temperature', '温度'], ['feels_like', '体感温度'], ['humidity', '湿度'],
  ['wind', '风'], ['air_quality', '空气质量'], ['daylight', '昼夜 / 天色'],
  ['environment_summary', '环境摘要'], ['change_summary', '变化摘要'], ['trigger_reason', '触发原因']
];
const TEMPLATE_DEFAULTS = {
  scheduled: ['人类现实环境定时更新｜{{observed_time}}','{{period}}天气：{{weather}}','温度 {{temperature}}，体感 {{feels_like}}；湿度 {{humidity}}；{{wind}}。','天色：{{daylight}}；空气质量：{{air_quality}}。','{{environment_summary}}'].join('\n'),
  change: ['人类现实环境变化｜{{observed_time}}','触发原因：{{trigger_reason}}','变化：{{change_summary}}','当前天气：{{weather}}；温度 {{temperature}}，体感 {{feels_like}}。','{{environment_summary}}'].join('\n')
};
const TEMPLATE_TOKEN = /{{\s*([a-zA-Z0-9_]+)\s*}}/g;
const TEMPLATE_ALLOWED = new Set(TEMPLATE_VARIABLES.map(([name]) => name));
function templateValues(snapshot, kind) {
  const sunTimes = snapshot.sunrise && snapshot.sunset ? `；日出 ${snapshot.sunrise}，日落 ${snapshot.sunset}` : '';
  return { observed_time:snapshot.observedAt||'', period:kind==='scheduled'?'当前':'变化后', weather:snapshot.weather||'未知', temperature:`${snapshot.temperature}℃`, feels_like:`${snapshot.feelsLike}℃`, humidity:`${snapshot.humidity}%`, wind:snapshot.wind||'未知', air_quality:snapshot.airQuality||'未启用', daylight:`${snapshot.light||'未知'}${sunTimes}`, environment_summary:snapshot.summary||'', change_summary:(snapshot.changes||[]).join('；'), trigger_reason:kind==='scheduled'?'定时环境更新':'模拟显著变化' };
}
function validateTemplateDraft(text) {
  if (typeof text !== 'string' || !text.trim()) throw new Error('模板不能为空');
  if (text.length > 4000) throw new Error('模板不能超过 4000 个字符');
  const unknown = [...new Set([...text.matchAll(TEMPLATE_TOKEN)].map(match=>match[1]).filter(name=>!TEMPLATE_ALLOWED.has(name)))];
  if (unknown.length) throw new Error(`未知变量：${unknown.map(name=>`{{${name}}}`).join('、')}`);
  return text;
}
function renderTemplatePreview(text, snapshot, kind) {
  const values = templateValues(snapshot, kind);
  const rendered = validateTemplateDraft(text).replace(TEMPLATE_TOKEN, (_, name) => String(values[name] ?? ''));
  if (rendered.length > 6000) throw new Error('最终正文不能超过 6000 个字符');
  return rendered;
}
