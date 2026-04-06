import { Link, useLocation, type PathName } from "../nav";
import logoSrc from "../../imports/logo-voreaStudio-h.svg";
import { useI18n } from "../services/i18n-context";

export function Footer() {
  const { pathname } = useLocation();
  const { t } = useI18n();

  // Don't show footer in editor
  if (pathname === "/studio") return null;

  const SECTIONS = [
    {
      title: t("footer.platform"),
      links: [
        { label: t("footer.link.home"), route: "/" },
        { label: t("footer.link.studio"), route: "/studio" },
        { label: t("footer.link.community"), route: "/community" },
        { label: t("footer.link.profile"), route: "/profile" },
      ],
    },
    {
      title: t("footer.tools"),
      links: [
        { label: t("footer.link.parametric"), route: "/studio?mode=parametric" },
        { label: t("footer.link.organic"), route: "/organic" },
        { label: t("footer.link.aiStudio"), route: "/ai-studio" },
        { label: t("footer.link.makerworld"), route: "/makerworld" },
      ],
    },
    {
      title: t("footer.account"),
      links: [
        { label: t("footer.link.membership"), route: "/plans" },
        { label: t("footer.link.userProfile"), route: "/profile" },
      ],
    },
  ];

  return (
    <footer className="border-t border-[rgba(168,187,238,0.12)] bg-[#0a0e17]">
      <div className="max-w-7xl mx-auto px-6 py-14">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <img
              src={logoSrc}
              alt="Vorea Studio"
              className="h-5 w-auto mb-4 opacity-80"
            />
            <p className="text-xs text-gray-500 leading-relaxed max-w-xs">
              {t("footer.description")}
            </p>
          </div>

          {/* Link sections */}
          {SECTIONS.map((section) => (
            <div key={section.title}>
              <h4 className="text-xs text-gray-400 uppercase tracking-widest mb-4">
                {section.title}
              </h4>
              <ul className="space-y-2.5">
                {section.links.map((link) => (
                  <li key={link.route + link.label}>
                    <Link
                      to={link.route}
                      className="text-sm text-gray-500 hover:text-[#C6E36C] transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-[rgba(168,187,238,0.08)] mt-12 pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-[11px] text-gray-600">
            {t("footer.rights")}
          </p>
          <div className="flex items-center gap-6 text-[11px] text-gray-600">
            <Link to="/terms" className="hover:text-gray-400 transition-colors">
              {t("footer.terms")}
            </Link>
            <Link to="/privacy" className="hover:text-gray-400 transition-colors">
              {t("footer.privacy")}
            </Link>
            <Link to="/contact" className="hover:text-gray-400 transition-colors">
              {t("footer.contact")}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
