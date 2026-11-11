# Flutter golden helpers (alchemist)

Copy into a package's `test/`:

| File | To |
|---|---|
| `flutter_test_config.dart` | `test/flutter_test_config.dart` |
| `tolerant_golden_comparator.dart`, `golden_scenario.dart`, `golden_frame.dart` | `test/helpers/` |
| `dart_test.yaml` | next to `pubspec.yaml` |

`dev_dependencies: alchemist: ^0.12.0` (or the current version). Bundle the app's fonts in the package so platform
goldens render real text. Component test:

```dart
void main() {
  scenarioGoldens(
    fileName: 'app_button',
    width: 360,
    scenarios: fourVariants(name: 'primary', themeFor: appThemeFor, build: () => AppButton(label: 'Continue', onPressed: () {})),
  );
}
```

Screen test: `screenGoldens(fileName: 'feed_default_light_en', builder: () => FeedPageHarness(...));`

Regenerate only what changed: `flutter test --update-goldens [--tags platform] test/path/to/file_test.dart`.
Compare a platform golden with its reference: `node tool/design/compare.mjs <golden> design/reference/<screen>/viewport.light.en.png`.
