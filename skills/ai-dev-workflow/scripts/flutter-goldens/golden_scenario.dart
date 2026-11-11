import 'dart:async';

import 'package:alchemist/alchemist.dart';
import 'package:flutter/material.dart';

typedef ThemedScenario = ({String name, Widget child});

// Replace with the app's theme factory, e.g. AppTheme.dark(isRtl: rtl).
typedef ThemeFor = ThemeData Function({required bool dark, required bool rtl});

ThemedScenario themedScenario({
  required String name,
  required bool dark,
  required bool rtl,
  required ThemeFor themeFor,
  required Widget child,
}) {
  final theme = themeFor(dark: dark, rtl: rtl);
  return (
    name: name,
    child: Theme(
      data: theme,
      child: Directionality(
        textDirection: rtl ? TextDirection.rtl : TextDirection.ltr,
        child: ColoredBox(color: theme.scaffoldBackgroundColor, child: child),
      ),
    ),
  );
}

// Every variant of one component: light/dark × LTR/RTL.
List<ThemedScenario> fourVariants({
  required String name,
  required ThemeFor themeFor,
  required Widget Function() build,
}) => [
  for (final dark in [false, true])
    for (final rtl in [false, true])
      themedScenario(
        name: '${name}_${dark ? 'dark' : 'light'}_${rtl ? 'rtl' : 'ltr'}',
        dark: dark,
        rtl: rtl,
        themeFor: themeFor,
        child: build(),
      ),
];

// One golden per scenario: a grid hides regressions in a large image and
// clips cells once it outgrows its constraints.
void scenarioGoldens({
  required String fileName,
  required double width,
  required List<ThemedScenario> scenarios,
  PumpAction pumpBeforeTest = onlyPumpAndSettle,
}) {
  for (final scenario in scenarios) {
    unawaited(
      goldenTest(
        '$fileName ${scenario.name}',
        fileName: '${fileName}_${scenario.name}',
        constraints: BoxConstraints.tightFor(width: width),
        pumpBeforeTest: pumpBeforeTest,
        builder: () => scenario.child,
      ),
    );
  }
}
