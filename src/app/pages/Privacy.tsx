/**
 * Privacy – Política de Privacidad de Vorea Studio
 * Propiedad de voreastudio.com – Martín Darío Daguerre
 */

import { Shield, Eye, Database, Lock, Bell, Trash2, Globe } from "lucide-react";
import { useI18n } from "../services/i18n-context";

export function Privacy() {
  const { t } = useI18n();

  return (
    <div className="max-w-4xl mx-auto px-6 py-16">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
          <Shield className="w-6 h-6 text-purple-400" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">{t("privacy.pageTitle")}</h1>
          <p className="text-sm text-gray-500">{t("privacy.pageUpdated")}</p>
        </div>
      </div>

      <div className="space-y-8 text-gray-300 text-sm leading-relaxed">
        {/* Intro */}
        <section className="glass rounded-2xl border border-[rgba(168,187,238,0.12)] p-8">
          <p>
            {t("privacy.intro")}
          </p>
        </section>

        {/* Data collected */}
        <section className="glass rounded-2xl border border-[rgba(168,187,238,0.12)] p-8">
          <div className="flex items-center gap-2 mb-4">
            <Database className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg font-semibold text-white">{t("privacy.s1.title")}</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium text-white mb-2">{t("privacy.s1.providedTitle")}</h3>
              <ul className="space-y-1.5 pl-5 list-disc text-gray-400">
                <li>{t("privacy.s1.provided1")}</li>
                <li>{t("privacy.s1.provided2")}</li>
                <li>{t("privacy.s1.provided3")}</li>
                <li>{t("privacy.s1.provided4")}</li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-medium text-white mb-2">{t("privacy.s1.autoTitle")}</h3>
              <ul className="space-y-1.5 pl-5 list-disc text-gray-400">
                <li>{t("privacy.s1.auto1")}</li>
                <li>{t("privacy.s1.auto2")}</li>
                <li>{t("privacy.s1.auto3")}</li>
                <li>{t("privacy.s1.auto4")}</li>
              </ul>
            </div>
          </div>
        </section>

        {/* How we use */}
        <section className="glass rounded-2xl border border-[rgba(168,187,238,0.12)] p-8">
          <div className="flex items-center gap-2 mb-4">
            <Eye className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg font-semibold text-white">{t("privacy.s2.title")}</h2>
          </div>
          <ul className="space-y-2 pl-5 list-disc text-gray-400">
            <li><strong className="text-gray-300">{t("privacy.s2.item1")}</strong> {t("privacy.s2.item1Desc")}</li>
            <li><strong className="text-gray-300">{t("privacy.s2.item2")}</strong> {t("privacy.s2.item2Desc")}</li>
            <li><strong className="text-gray-300">{t("privacy.s2.item3")}</strong> {t("privacy.s2.item3Desc")}</li>
            <li><strong className="text-gray-300">{t("privacy.s2.item4")}</strong> {t("privacy.s2.item4Desc")}</li>
            <li><strong className="text-gray-300">{t("privacy.s2.item5")}</strong> {t("privacy.s2.item5Desc")}</li>
          </ul>
        </section>

        {/* Data sharing */}
        <section className="glass rounded-2xl border border-[rgba(168,187,238,0.12)] p-8">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg font-semibold text-white">{t("privacy.s3.title")}</h2>
          </div>
          <p className="mb-3"><strong className="text-white">{t("privacy.s3.intro")}</strong> {t("privacy.s3.introDesc")}</p>
          <ul className="space-y-2 pl-5 list-disc text-gray-400">
            <li><strong className="text-gray-300">{t("privacy.s3.item1")}</strong> {t("privacy.s3.item1Desc")}</li>
            <li><strong className="text-gray-300">{t("privacy.s3.item2")}</strong> {t("privacy.s3.item2Desc")}</li>
            <li><strong className="text-gray-300">{t("privacy.s3.item3")}</strong> {t("privacy.s3.item3Desc")}</li>
          </ul>
        </section>

        {/* Security */}
        <section className="glass rounded-2xl border border-[rgba(168,187,238,0.12)] p-8">
          <div className="flex items-center gap-2 mb-4">
            <Lock className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg font-semibold text-white">{t("privacy.s4.title")}</h2>
          </div>
          <p>{t("privacy.s4.body")}</p>
          <p className="mt-3 text-gray-500 text-xs">{t("privacy.s4.disclaimer")}</p>
        </section>

        {/* Cookies */}
        <section className="glass rounded-2xl border border-[rgba(168,187,238,0.12)] p-8">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg font-semibold text-white">{t("privacy.s5.title")}</h2>
          </div>
          <p>{t("privacy.s5.intro")}</p>
          <ul className="mt-2 space-y-1.5 pl-5 list-disc text-gray-400">
            <li>{t("privacy.s5.item1")}</li>
            <li>{t("privacy.s5.item2")}</li>
            <li>{t("privacy.s5.item3")}</li>
          </ul>
          <p className="mt-3">{t("privacy.s5.noThirdParty")}</p>
        </section>

        {/* User rights */}
        <section className="glass rounded-2xl border border-[rgba(168,187,238,0.12)] p-8">
          <div className="flex items-center gap-2 mb-4">
            <Trash2 className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg font-semibold text-white">{t("privacy.s6.title")}</h2>
          </div>
          <p>{t("privacy.s6.intro")}</p>
          <ul className="mt-2 space-y-1.5 pl-5 list-disc text-gray-400">
            <li><strong className="text-gray-300">{t("privacy.s6.access")}</strong> {t("privacy.s6.accessDesc")}</li>
            <li><strong className="text-gray-300">{t("privacy.s6.rectification")}</strong> {t("privacy.s6.rectificationDesc")}</li>
            <li><strong className="text-gray-300">{t("privacy.s6.deletion")}</strong> {t("privacy.s6.deletionDesc")}</li>
            <li><strong className="text-gray-300">{t("privacy.s6.portability")}</strong> {t("privacy.s6.portabilityDesc")}</li>
            <li><strong className="text-gray-300">{t("privacy.s6.opposition")}</strong> {t("privacy.s6.oppositionDesc")}</li>
          </ul>
          <p className="mt-3">{t("privacy.s6.contact")}</p>
        </section>

        {/* Children */}
        <section className="glass rounded-2xl border border-[rgba(168,187,238,0.12)] p-8">
          <h2 className="text-lg font-semibold text-white mb-4">{t("privacy.s7.title")}</h2>
          <p>{t("privacy.s7.body")}</p>
        </section>

        {/* Contact */}
        <section className="glass rounded-2xl border border-[rgba(168,187,238,0.12)] p-8">
          <h2 className="text-lg font-semibold text-white mb-4">{t("privacy.s8.title")}</h2>
          <p>{t("privacy.s8.body")}</p>
        </section>

        <div className="text-center text-xs text-gray-600 pt-4">
          <p>{t("common.copyright")}</p>
        </div>
      </div>
    </div>
  );
}
