/**
 * Expo config plugin that injects a fmt-pod patch into the iOS Podfile's
 * `post_install` hook.
 *
 * Why: React Native 0.81 pins fmt 11.0.2. Xcode 26 / clang 21 (Apple
 * clang 21.0.0) enforce `consteval` more strictly than older toolchains
 * and reject fmt's `basic_format_string<...>` constructor for
 * non-literal format strings. The build then fails inside
 * `Pods/fmt/include/fmt/format-inl.h` with errors like:
 *
 *   Call to consteval function 'fmt::basic_format_string<...>' is not a
 *   constant expression
 *
 * Defining `FMT_USE_CONSTEVAL=0` for the fmt pod target only flips the
 * constructor back to a regular constexpr, so the build proceeds.
 * Runtime behaviour is unchanged — only fmt's compile-time format
 * checking is dropped, which we don't rely on.
 *
 * Bound to the fmt target by name so unrelated pods aren't affected.
 * Idempotent: re-running prebuild won't append duplicate snippets.
 */
const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const SNIPPET_MARKER = '# fmt-consteval-fix';
const SNIPPET = `
    ${SNIPPET_MARKER}
    installer.pods_project.targets.each do |target|
      next unless target.name == 'fmt'
      target.build_configurations.each do |config|
        defs = config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] || ['$(inherited)']
        defs = [defs] unless defs.is_a?(Array)
        defs << 'FMT_USE_CONSTEVAL=0' unless defs.include?('FMT_USE_CONSTEVAL=0')
        config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] = defs
      end
    end
`;

function patchPodfile(podfilePath) {
  let src = fs.readFileSync(podfilePath, 'utf8');
  if (src.includes(SNIPPET_MARKER)) return false;

  // Inject right after `react_native_post_install(...)` inside the
  // existing `post_install do |installer|` block. Match the closing
  // paren + newline of the react_native_post_install call.
  const anchor = /react_native_post_install\([\s\S]*?\)\n/;
  if (!anchor.test(src)) {
    throw new Error(
      '[withIosFmtConstevalFix] could not locate react_native_post_install call in Podfile',
    );
  }
  src = src.replace(anchor, (m) => m + SNIPPET);
  fs.writeFileSync(podfilePath, src);
  return true;
}

const withIosFmtConstevalFix = (config) =>
  withDangerousMod(config, [
    'ios',
    (cfg) => {
      const podfile = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      if (fs.existsSync(podfile)) patchPodfile(podfile);
      return cfg;
    },
  ]);

module.exports = withIosFmtConstevalFix;
