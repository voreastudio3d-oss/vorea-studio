/**
 * Terms – Términos de Servicio de Vorea Studio
 * Propiedad de voreastudio.com – Martín Darío Daguerre
 */

import { Shield, FileText, Users, Scale, AlertTriangle, Globe } from "lucide-react";
import { useI18n } from "../services/i18n-context";

export function Terms() {
  const { t } = useI18n();

  return (
    <div className="max-w-4xl mx-auto px-6 py-16">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 rounded-2xl bg-[#C6E36C]/10 border border-[#C6E36C]/20 flex items-center justify-center">
          <Scale className="w-6 h-6 text-[#C6E36C]" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">{t("terms.pageTitle")}</h1>
          <p className="text-sm text-gray-500">{t("terms.pageUpdated")}</p>
        </div>
      </div>

      <div className="space-y-8 text-gray-300 text-sm leading-relaxed">
        {/* Section 1 */}
        <section className="glass rounded-2xl border border-[rgba(168,187,238,0.12)] p-8">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-5 h-5 text-[#C6E36C]" />
            <h2 className="text-lg font-semibold text-white">{t("terms.s1.title")}</h2>
          </div>
          <p>{t("terms.s1.body1")}</p>
          <p className="mt-3">{t("terms.s1.body2")}</p>
        </section>

        {/* Section 2 */}
        <section className="glass rounded-2xl border border-[rgba(168,187,238,0.12)] p-8">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="w-5 h-5 text-[#C6E36C]" />
            <h2 className="text-lg font-semibold text-white">{t("terms.s2.title")}</h2>
          </div>
          <p>{t("terms.s2.intro")}</p>
          <ul className="mt-3 space-y-2 pl-5 list-disc text-gray-400">
            <li>{t("terms.s2.item1")}</li>
            <li>{t("terms.s2.item2")}</li>
            <li>{t("terms.s2.item3")}</li>
            <li>{t("terms.s2.item4")}</li>
            <li>{t("terms.s2.item5")}</li>
          </ul>
        </section>

        {/* Section 3 */}
        <section className="glass rounded-2xl border border-[rgba(168,187,238,0.12)] p-8">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-[#C6E36C]" />
            <h2 className="text-lg font-semibold text-white">{t("terms.s3.title")}</h2>
          </div>
          <p>{t("terms.s3.intro")}</p>
          <ul className="mt-3 space-y-2 pl-5 list-disc text-gray-400">
            <li>{t("terms.s3.item1")}</li>
            <li>{t("terms.s3.item2")}</li>
            <li>{t("terms.s3.item3")}</li>
            <li>{t("terms.s3.item4")}</li>
          </ul>
          <p className="mt-3 text-gray-500 text-xs">{t("terms.s3.disclaimer")}</p>
        </section>

        {/* Section 4 */}
        <section className="glass rounded-2xl border border-[rgba(168,187,238,0.12)] p-8">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-5 h-5 text-[#C6E36C]" />
            <h2 className="text-lg font-semibold text-white">{t("terms.s4.title")}</h2>
          </div>
          <p><strong className="text-white">{t("terms.s4.platform")}</strong> {t("terms.s4.platformDesc")}</p>
          <p className="mt-3"><strong className="text-white">{t("terms.s4.user")}</strong> {t("terms.s4.userDesc")}</p>
          <ul className="mt-2 space-y-1 pl-5 list-disc text-gray-400">
            <li><strong className="text-gray-300">{t("terms.s4.by")}</strong> {t("terms.s4.byDesc")}</li>
            <li><strong className="text-gray-300">{t("terms.s4.sa")}</strong> {t("terms.s4.saDesc")}</li>
          </ul>
          <p className="mt-3"><strong className="text-white">{t("terms.s4.forks")}</strong> {t("terms.s4.forksDesc")}</p>
        </section>

        {/* Section 5 */}
        <section className="glass rounded-2xl border border-[rgba(168,187,238,0.12)] p-8">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-semibold text-white">{t("terms.s5.title")}</h2>
          </div>
          <p>{t("terms.s5.intro")}</p>
          <ul className="mt-3 space-y-2 pl-5 list-disc text-gray-400">
            <li>{t("terms.s5.item1")}</li>
            <li>{t("terms.s5.item2")}</li>
            <li>{t("terms.s5.item3")}</li>
            <li>{t("terms.s5.item4")}</li>
            <li>{t("terms.s5.item5")}</li>
          </ul>
        </section>

        {/* Section 6 */}
        <section className="glass rounded-2xl border border-[rgba(168,187,238,0.12)] p-8">
          <h2 className="text-lg font-semibold text-white mb-4">{t("terms.s6.title")}</h2>
          <p>{t("terms.s6.body")}</p>
        </section>

        {/* Section 7 */}
        <section className="glass rounded-2xl border border-[rgba(168,187,238,0.12)] p-8">
          <h2 className="text-lg font-semibold text-white mb-4">{t("terms.s7.title")}</h2>
          <p>{t("terms.s7.body")}</p>
        </section>

        {/* Section 8 */}
        <section className="glass rounded-2xl border border-[rgba(168,187,238,0.12)] p-8">
          <h2 className="text-lg font-semibold text-white mb-4">{t("terms.s8.title")}</h2>
          <p>{t("terms.s8.body")}</p>
        </section>

        <div className="text-center text-xs text-gray-600 pt-4">
          <p>{t("common.copyright")}</p>
        </div>
      </div>
    </div>
  );
}
