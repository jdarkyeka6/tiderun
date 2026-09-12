#if UNITY_EDITOR
using UnityEditor;
using UnityEngine;

namespace Tiderun.Editor
{
    [InitializeOnLoad]
    public static class TiderunProjectSetup
    {
        private const string BundleId = "com.tidegames.tiderun";

        static TiderunProjectSetup()
        {
            EditorApplication.delayCall += Apply;
        }

        private static void Apply()
        {
            PlayerSettings.productName = "Tiderun";
            PlayerSettings.companyName = "Tide Games";
            PlayerSettings.defaultInterfaceOrientation = UIOrientation.Portrait;
            PlayerSettings.allowedAutorotateToPortrait = true;
            PlayerSettings.allowedAutorotateToPortraitUpsideDown = false;
            PlayerSettings.allowedAutorotateToLandscapeLeft = false;
            PlayerSettings.allowedAutorotateToLandscapeRight = false;

#pragma warning disable 0618
            PlayerSettings.SetApplicationIdentifier(BuildTargetGroup.iOS, BundleId);
#pragma warning restore 0618

            PlayerSettings.bundleVersion = "0.1.0";
        }
    }
}
#endif
