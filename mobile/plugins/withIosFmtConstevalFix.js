/**
 * Expo config plugin that patches fmt to disable its `consteval`
 * constructor on Xcode 26 / Apple clang 21.
 *
 * Why: React Native 0.81 pins fmt 11.0.2. The pinned version has a
 * consteval `basic_format_string<...>` ctor that newer Apple clang
 * (Xcode 26, clang 21) rejects for non-literal format strings, with
 * errors inside `Pods/fmt/include/fmt/format-inl.h`:
 *
 *   Call to consteval function 'fmt::basic_format_string<...>' is not
 *   a constant expression
 *
 * fmt's `base.h` redefines `FMT_USE_CONSTEVAL` based on compiler
 * feature flags with NO `#ifndef` guard, so command-line `-D` overrides
 * are silently clobbered. The only reliable fix is to patch `base.h`
 * directly, replacing the detection chain with a hard-coded
 * `#define FMT_USE_CONSTEVAL 0`. That makes `FMT_CONSTEVAL` expand to
 * nothing and `#if FMT_USE_CONSTEVAL` branches consistently take the
 * non-consteval path.
 *
 * The patch runs in two phases:
 *   1. Podfile post_install hook adds a Ruby block that:
 *        - chmod u+w the read-only Pods source
 *        - replaces the detection chain with a single #define
 *        - leaves a marker comment so re-runs are idempotent
 *   2. The plugin itself injects this hook into the Podfile during
 *      `expo prebuild`, so the post_install runs on every `pod install`.
 *
 * Runtime behaviour is unchanged — only fmt's compile-time format-string
 * checking is dropped, which we don't use.
 */
const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const SNIPPET_MARKER = '# fmt-consteval-fix';

// Ruby snippet that lives inside the Podfile's post_install block.
// Patches fmt's base.h to hardcode FMT_USE_CONSTEVAL=0. Idempotent via
// a marker comment in the patched file. Single-line patterns to keep
// the Ruby readable.
const PODFILE_SNIPPET = `
    ${SNIPPET_MARKER}
    fmt_base = File.expand_path('Pods/fmt/include/fmt/base.h', __dir__)
    if File.exist?(fmt_base)
      contents = File.read(fmt_base)
      marker = '(Patched by mobile/plugins/withIosFmtConstevalFix.js)'
      unless contents.include?(marker)
        chain_re = /\\/\\/ Detect consteval[\\s\\S]+?#endif\\n/
        if contents =~ chain_re
          replacement = "// Detect consteval, C++20 constexpr extensions and std::is_constant_evaluated.\\n" +
                        "// Forced to 0 — Xcode 26 / Apple clang 21 rejects fmt 11.0.2's\\n" +
                        "// basic_format_string<...> consteval ctor for non-literal format strings.\\n" +
                        "// #{marker}\\n" +
                        "#define FMT_USE_CONSTEVAL 0\\n"
          contents = contents.sub(chain_re, replacement)
          File.chmod(0644, fmt_base)
          File.write(fmt_base, contents)
          puts '[withIosFmtConstevalFix] patched fmt base.h'
        end
      end
    end
`;

function patchPodfile(podfilePath) {
  let src = fs.readFileSync(podfilePath, 'utf8');
  if (src.includes(SNIPPET_MARKER)) return false;

  const anchor = /react_native_post_install\([\s\S]*?\)\n/;
  if (!anchor.test(src)) {
    throw new Error(
      '[withIosFmtConstevalFix] could not locate react_native_post_install call in Podfile',
    );
  }
  src = src.replace(anchor, (m) => m + PODFILE_SNIPPET);
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
