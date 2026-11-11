import 'dart:async';

import 'package:alchemist/alchemist.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

// Set these to the design's device frame and safe areas (the prototype's
// top/bottom padding), so a screen golden lines up with its reference PNG.
const designFrame = Size(402, 874);
const designSafeArea = EdgeInsets.only(top: 54, bottom: 22);

Widget screenFrame({required Widget child}) => MediaQuery(
  data: const MediaQueryData(
    size: designFrame,
    padding: designSafeArea,
    // A shimmer or transition caught mid-way differs between machines.
    disableAnimations: true,
  ),
  child: SizedBox.fromSize(size: designFrame, child: child),
);

// Enough frames for async translations and images from test/ to arrive.
Future<void> pumpFrames(WidgetTester tester) async {
  for (var i = 0; i < 20; i++) {
    await tester.pump(const Duration(milliseconds: 20));
  }
}

// The same screen as a tolerant CI golden (goldens/ci/) and, tagged
// `platform`, as an exact golden with real fonts (goldens/<os>/) that is
// compared with design/reference via compare.mjs.
void screenGoldens({
  required String fileName,
  required Widget Function() builder,
  bool platform = true,
  PumpAction pumpBeforeTest = pumpFrames,
}) {
  unawaited(
    goldenTest(
      fileName,
      fileName: fileName,
      pumpBeforeTest: pumpBeforeTest,
      builder: () => screenFrame(child: builder()),
    ),
  );
  if (!platform) return;
  unawaited(
    AlchemistConfig.runWithConfig(
      config: const AlchemistConfig(
        ciGoldensConfig: CiGoldensConfig(enabled: false),
        platformGoldensConfig: PlatformGoldensConfig(),
      ),
      run: () async => await goldenTest(
        '$fileName (platform)',
        fileName: fileName,
        tags: const ['platform'],
        pumpBeforeTest: pumpBeforeTest,
        builder: () => screenFrame(child: builder()),
      ),
    ),
  );
}
