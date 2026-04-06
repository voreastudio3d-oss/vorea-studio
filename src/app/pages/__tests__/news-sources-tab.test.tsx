import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NewsSourcesTab } from "../NewsSourcesTab";

const apiMocks = vi.hoisted(() => ({
  listSources: vi.fn(),
  getSourceStats: vi.fn(),
  updateSource: vi.fn(),
  createSource: vi.fn(),
  deleteSource: vi.fn(),
  triggerIngest: vi.fn(),
}));

vi.mock("../../services/api-client", async () => {
  const actual = await vi.importActual("../../services/api-client");
  return {
    ...actual,
    NewsAdminApi: apiMocks,
  };
});

describe("NewsSourcesTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.listSources.mockResolvedValue([
      {
        id: "ns_macrotec",
        slug: "macrotec",
        name: "Macrotec Uruguay",
        type: "news",
        language: "es",
        baseUrl: "https://www.macrotec.com.uy",
        feedUrl: null,
        listingUrl: "https://www.macrotec.com.uy/blog",
        fetchMode: "listing",
        enabled: true,
        priority: 10,
        editorialPolicy: "brief_only",
        editorialNotes: "Fuente comercial útil para radar local.",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);
    apiMocks.getSourceStats.mockResolvedValue([]);
    apiMocks.updateSource.mockImplementation(async (_id: string, patch: any) => ({
      id: "ns_macrotec",
      slug: "macrotec",
      name: "Macrotec Uruguay",
      type: "news",
      language: "es",
      baseUrl: "https://www.macrotec.com.uy",
      feedUrl: null,
      listingUrl: "https://www.macrotec.com.uy/blog",
      fetchMode: "listing",
      enabled: true,
      priority: 10,
      editorialPolicy: patch.editorialPolicy ?? "brief_only",
      editorialNotes: patch.editorialNotes ?? "Fuente comercial útil para radar local.",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
  });

  it("shows source governance state and saves editorial policy changes", async () => {
    render(<NewsSourcesTab />);

    expect(await screen.findByText("Macrotec Uruguay")).toBeInTheDocument();
    expect(screen.getAllByText("Solo brief").length).toBeGreaterThan(0);
    expect(screen.getByText("Fuente comercial útil para radar local.")).toBeInTheDocument();

    fireEvent.click(screen.getByTitle("Editar fuente"));

    const policySelects = await screen.findAllByDisplayValue("Solo brief");
    fireEvent.change(policySelects[policySelects.length - 1], {
      target: { value: "standard" },
    });

    const notes = screen.getByDisplayValue("Fuente comercial útil para radar local.");
    fireEvent.change(notes, {
      target: { value: "Subir a estándar cuando aparezcan análisis propios." },
    });

    fireEvent.click(screen.getByRole("button", { name: /Guardar Cambios/i }));

    await waitFor(() =>
      expect(apiMocks.updateSource).toHaveBeenCalledWith("ns_macrotec", {
        editorialPolicy: "standard",
        editorialNotes: "Subir a estándar cuando aparezcan análisis propios.",
      })
    );
  });
});
