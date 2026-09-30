// Gradle не принимает имя проекта с точкой на конце («рядом.»). На телефоне название остаётся «рядом.»,
// а внутреннее имя Android-проекта при сборке — «ryadom».
const { withSettingsGradle } = require('@expo/config-plugins');

module.exports = function withGradleName(config) {
  return withSettingsGradle(config, (cfg) => {
    cfg.modResults.contents = cfg.modResults.contents.replace(/rootProject\.name\s*=\s*['"][^'"]*['"]/, "rootProject.name = 'ryadom'");
    return cfg;
  });
};
