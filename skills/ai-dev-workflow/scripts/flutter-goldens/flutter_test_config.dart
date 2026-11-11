import 'dart:async';

import 'package:alchemist/alchemist.dart';

import 'helpers/tolerant_golden_comparator.dart';

// Picked up automatically by `flutter test` for every test under this folder.
Future<void> testExecutable(FutureOr<void> Function() testMain) {
  useTolerantGoldenComparator();
  return AlchemistConfig.runWithConfig(
    config: const AlchemistConfig(
      platformGoldensConfig: PlatformGoldensConfig(enabled: false),
    ),
    run: () async => await testMain(),
  );
}
