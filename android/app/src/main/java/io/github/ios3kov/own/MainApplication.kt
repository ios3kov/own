package io.github.ios3kov.own

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import io.github.ios3kov.own.download.DownloadManagerPackage
import io.github.ios3kov.own.localdream.LocalDreamPackage
import io.github.ios3kov.own.pdf.PDFExtractorPackage
import io.github.ios3kov.own.litert.LiteRTPackage

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // Packages that cannot be autolinked yet can be added manually here, for example:
          add(DownloadManagerPackage())
          add(LocalDreamPackage())
          add(PDFExtractorPackage())
          add(LiteRTPackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
  }
}
