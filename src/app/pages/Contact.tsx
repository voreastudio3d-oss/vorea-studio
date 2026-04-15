/**
 * Contact – Página de Contacto de Vorea Studio
 * Propiedad de voreastudio3d.com – Martín Darío Daguerre
 */

import { useState } from "react";
import { Button } from "../components/ui/button";
import { toast } from "sonner";
import { Mail, MapPin, Send, Loader2, Globe, MessageSquare } from "lucide-react";
import { useI18n } from "../services/i18n-context";
import { ContactApi } from "../services/api-client";
import { trackAnalyticsEvent } from "../services/analytics";

export function Contact() {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      return params.get("subject") || "";
    }
    return "";
  });
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [submitted, setSubmitted] = useState<{ contactId: string; email: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) {
      toast.error(t("contact.form.fillRequired"));
      return;
    }
    setSending(true);
    try {
      const result = await ContactApi.submit({
        name: name.trim(),
        email: email.trim(),
        subject: subject.trim(),
        message: message.trim(),
        pageUrl: typeof window !== "undefined" ? window.location.href : "/contacto",
      });
      trackAnalyticsEvent("contact_submit", {
        source: "contact_page",
        has_subject: Boolean(subject.trim()),
      });
      toast.success(t("contact.form.success"));
      setSubmitted({ contactId: result.contactId, email: email.trim() });
      setName("");
      setEmail("");
      setSubject("");
      setMessage("");
    } catch (error: any) {
      toast.error(error?.message || "No pudimos enviar tu mensaje. Intenta de nuevo.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-16">
      <div className="flex items-center gap-3 mb-10">
        <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
          <MessageSquare className="w-6 h-6 text-blue-400" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">{t("contact.title")}</h1>
          <p className="text-sm text-gray-500">{t("contact.subtitle")}</p>
        </div>
      </div>

      <div className="grid md:grid-cols-5 gap-10">
        {/* Contact info */}
        <div className="md:col-span-2 space-y-6">
          <div className="glass rounded-2xl border border-[rgba(168,187,238,0.12)] p-6">
            <h3 className="text-sm font-semibold text-white mb-4">{t("contact.info")}</h3>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Mail className="w-4 h-4 text-[#C6E36C] mt-0.5" />
                <div>
                  <p className="text-sm text-white">{t("contact.email")}</p>
                  <a href="mailto:hola@voreastudio3d.com" className="text-xs text-gray-400 hover:text-[#C6E36C] transition-colors">
                    hola@voreastudio3d.com
                  </a>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Globe className="w-4 h-4 text-[#C6E36C] mt-0.5" />
                <div>
                  <p className="text-sm text-white">{t("contact.web")}</p>
                  <a href="https://voreastudio3d.com" className="text-xs text-gray-400 hover:text-[#C6E36C] transition-colors" target="_blank" rel="noopener">
                    voreastudio3d.com
                  </a>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-[#C6E36C] mt-0.5" />
                <div>
                  <p className="text-sm text-white">{t("contact.location")}</p>
                  <p className="text-xs text-gray-400">{t("contact.locationValue")}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="glass rounded-2xl border border-[rgba(168,187,238,0.12)] p-6">
            <h3 className="text-sm font-semibold text-white mb-3">{t("contact.responseTime.title")}</h3>
            <p className="text-xs text-gray-400">{t("contact.responseTime.desc")}</p>
          </div>

          <div className="glass rounded-2xl border border-[rgba(168,187,238,0.12)] p-6">
            <h3 className="text-sm font-semibold text-white mb-3">{t("contact.collaborate.title")}</h3>
            <p className="text-xs text-gray-400">{t("contact.collaborate.desc")}</p>
          </div>
        </div>

        {/* Contact form */}
        <div className="md:col-span-3">
          {submitted && (
            <div className="glass rounded-2xl border border-[#C6E36C]/20 bg-[#C6E36C]/5 p-6 mb-5">
              <h3 className="text-lg font-semibold text-white">Mensaje enviado</h3>
              <p className="text-sm text-gray-300 mt-2">
                Te escribiremos a <span className="text-[#C6E36C]">{submitted.email}</span> apenas revisemos tu consulta.
              </p>
              <p className="text-xs text-gray-500 mt-2">
                Referencia: <span className="font-mono">{submitted.contactId}</span>
              </p>
            </div>
          )}
          <form onSubmit={handleSubmit} className="glass rounded-2xl border border-[rgba(168,187,238,0.12)] p-8 space-y-5">
            <h3 className="text-lg font-semibold text-white mb-2">{t("contact.form.title")}</h3>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-wider mb-2 block">
                  {t("contact.form.name")} <span className="text-red-400">{t("contact.form.required")}</span>
                </label>
                <input
                  className="w-full bg-[#0d1117] border border-[rgba(168,187,238,0.15)] rounded-lg px-4 py-2.5 text-sm text-white outline-none focus:border-[#C6E36C]/50 transition-colors"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("contact.form.namePlaceholder")}
                  required
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-wider mb-2 block">
                  {t("contact.form.email")} <span className="text-red-400">{t("contact.form.required")}</span>
                </label>
                <input
                  type="email"
                  className="w-full bg-[#0d1117] border border-[rgba(168,187,238,0.15)] rounded-lg px-4 py-2.5 text-sm text-white outline-none focus:border-[#C6E36C]/50 transition-colors"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("contact.form.emailPlaceholder")}
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-400 uppercase tracking-wider mb-2 block">{t("contact.form.subject")}</label>
              <input
                className="w-full bg-[#0d1117] border border-[rgba(168,187,238,0.15)] rounded-lg px-4 py-2.5 text-sm text-white outline-none focus:border-[#C6E36C]/50 transition-colors"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder={t("contact.form.subjectPlaceholder")}
              />
            </div>

            <div>
              <label className="text-xs text-gray-400 uppercase tracking-wider mb-2 block">
                {t("contact.form.message")} <span className="text-red-400">{t("contact.form.required")}</span>
              </label>
              <textarea
                className="w-full bg-[#0d1117] border border-[rgba(168,187,238,0.15)] rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-[#C6E36C]/50 transition-colors resize-none"
                rows={6}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t("contact.form.messagePlaceholder")}
                required
              />
            </div>

            <Button
              type="submit"
              className="w-full gap-2"
              disabled={sending}
            >
              {sending ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> {t("contact.form.sending")}</>
              ) : (
                <><Send className="w-4 h-4" /> {t("contact.form.submit")}</>
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
