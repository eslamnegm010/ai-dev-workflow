import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';

// CI goldens rendered on different OSes differ by a few dozen anti-aliased
// pixels; any real layout change moves far more. Platform goldens stay exact.
const _ciPixelBudget = 64;

final class TolerantGoldenComparator extends LocalFileComparator {
  TolerantGoldenComparator(super.testFile);

  @override
  Future<bool> compare(Uint8List imageBytes, Uri golden) async {
    final result = await GoldenFileComparator.compareLists(
      imageBytes,
      await getGoldenBytes(golden),
    );
    final withinBudget =
        golden.path.contains('/ci/') &&
        result.diffPercent * _pixelCount(imageBytes) <= _ciPixelBudget;
    if (result.passed || withinBudget) {
      result.dispose();
      return true;
    }
    final error = await generateFailureOutput(result, golden, basedir);
    result.dispose();
    throw FlutterError(error);
  }

  // PNG IHDR: width and height are big-endian at bytes 16–23.
  static int _pixelCount(Uint8List png) {
    final data = ByteData.sublistView(png);
    return data.getUint32(16) * data.getUint32(20);
  }
}

void useTolerantGoldenComparator() {
  final current = goldenFileComparator;
  if (current is LocalFileComparator) {
    goldenFileComparator = TolerantGoldenComparator(
      Uri.parse('${current.basedir}golden_test.dart'),
    );
  }
}
