(() => {
  const mediaPathPrefixes = ["/images/uploads", "/images/profile-photos"];
  const suggestedUploadFolders = [
    "church-life",
    "community",
    "children-youth",
    "events",
    "people",
    "buildings",
    "branding",
    "archive",
  ];

  const normalizePath = (path) => {
    if (!path) return "/images/uploads";
    const normalized = path.startsWith("/") ? path : `/${path}`;
    return normalized.length > 1 ? normalized.replace(/\/+$/, "") : normalized;
  };

  const isManagedPath = (path) =>
    mediaPathPrefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));

  const titleFromSlug = (slug) =>
    slug
      .split("-")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");

  const sanitizeFolderName = (value) =>
    value
      .trim()
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "");

  const toAsset = (item) => ({
    id: item.path,
    name: item.name,
    path: item.path,
    url: item.path,
    displayURL: item.path,
    size: item.size,
  });

  const requestJson = async (url, options = {}) => {
    const response = await fetch(url, options);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || `Asset request failed with ${response.status}`);
    }

    return data;
  };

  const uploadAsset = async (file, targetFolder) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", normalizePath(targetFolder));

    return requestJson("/.netlify/functions/cdn-media", {
      method: "POST",
      body: formData,
    });
  };

  const chooseAsset = (asset, handlers) => {
    handlers.handleInsert(asset.path);
    handlers.handleClose();
  };

  const createDialog = ({ config, handlers }) => {
    const configuredFolder = normalizePath(config?.media_folder || "/images/uploads");
    const rootFolder = isManagedPath(configuredFolder) ? configuredFolder : "/images/uploads";
    let currentFolder = rootFolder;
    let allItems = [];

    const root = document.createElement("div");
    root.className = "sjp-media-library";
    root.innerHTML = `
      <div class="sjp-media-library__panel" role="dialog" aria-modal="true" aria-label="Cloudflare media library">
        <header class="sjp-media-library__header">
          <div>
            <strong>Media library</strong>
            <p>Browse by category or search across all images.</p>
          </div>
          <button type="button" data-close aria-label="Close media library">×</button>
        </header>

        <div class="sjp-media-library__toolbar">
          <label class="sjp-media-library__search">
            <span class="sr-only">Search media</span>
            <input type="search" data-search placeholder="Search images by filename or folder…" autocomplete="off" />
          </label>
          <button type="button" class="sjp-media-library__new-folder" data-new-folder>New category</button>
          <label class="sjp-media-library__upload">
            <span>Upload images</span>
            <input type="file" accept="image/*" multiple />
          </label>
        </div>

        <nav class="sjp-media-library__breadcrumbs" data-breadcrumbs aria-label="Media folders"></nav>
        <div class="sjp-media-library__folders" data-folders></div>
        <p class="sjp-media-library__status" data-status>Loading assets…</p>
        <div class="sjp-media-library__grid" data-grid></div>
      </div>
    `;

    const style = document.createElement("style");
    style.textContent = `
      .sjp-media-library { position: fixed; inset: 0; z-index: 10000; display: grid; place-items: center; background: rgba(0, 0, 0, 0.48); font-family: system-ui, sans-serif; }
      .sjp-media-library * { box-sizing: border-box; }
      .sjp-media-library .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
      .sjp-media-library__panel { width: min(1080px, calc(100vw - 2rem)); max-height: min(820px, calc(100vh - 2rem)); overflow: auto; background: #fff; border-radius: 16px; box-shadow: 0 24px 90px rgba(0, 0, 0, 0.28); padding: 1.25rem; }
      .sjp-media-library__header { display: flex; align-items: start; justify-content: space-between; gap: 1rem; margin-bottom: 1rem; }
      .sjp-media-library__header strong { font-size: 1.15rem; }
      .sjp-media-library__header p { margin: .25rem 0 0; color: #58606b; }
      .sjp-media-library__header button { border: 0; background: #f0f1f3; border-radius: 999px; width: 2rem; height: 2rem; font-size: 1.35rem; cursor: pointer; }
      .sjp-media-library__toolbar { display: grid; grid-template-columns: minmax(220px, 1fr) auto auto; gap: .65rem; align-items: center; margin-bottom: .85rem; }
      .sjp-media-library__search input { width: 100%; min-height: 2.75rem; border: 1px solid #c9ced6; border-radius: 10px; padding: .65rem .8rem; font: inherit; }
      .sjp-media-library__new-folder, .sjp-media-library__upload { min-height: 2.75rem; display: inline-flex; align-items: center; justify-content: center; border: 1px solid #87909c; border-radius: 10px; padding: .65rem .9rem; background: #fff; cursor: pointer; font: inherit; }
      .sjp-media-library__upload { background: #172f27; color: #fff; border-color: #172f27; }
      .sjp-media-library__upload input { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
      .sjp-media-library__breadcrumbs { display: flex; flex-wrap: wrap; gap: .35rem; align-items: center; margin: .2rem 0 .8rem; color: #58606b; font-size: .9rem; }
      .sjp-media-library__breadcrumb { border: 0; background: transparent; color: #234f42; padding: .2rem .25rem; cursor: pointer; font: inherit; text-decoration: underline; text-underline-offset: 2px; }
      .sjp-media-library__breadcrumb[aria-current='page'] { color: #343a40; text-decoration: none; cursor: default; font-weight: 600; }
      .sjp-media-library__folders { display: flex; flex-wrap: wrap; gap: .55rem; margin-bottom: .8rem; }
      .sjp-media-library__folder { display: inline-flex; gap: .4rem; align-items: center; border: 1px solid #d9dde3; background: #f7f8f9; border-radius: 999px; padding: .48rem .75rem; cursor: pointer; font: inherit; font-size: .9rem; }
      .sjp-media-library__folder::before { content: '▰'; font-size: .72rem; color: #7a838e; }
      .sjp-media-library__status { color: #58606b; margin: .65rem 0; }
      .sjp-media-library__grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(145px, 1fr)); gap: .85rem; }
      .sjp-media-library__asset { display: grid; gap: .45rem; border: 1px solid #e1e4e8; background: #fff; border-radius: 12px; padding: .5rem; cursor: pointer; text-align: left; min-width: 0; }
      .sjp-media-library__asset:hover, .sjp-media-library__asset:focus-visible, .sjp-media-library__folder:hover, .sjp-media-library__folder:focus-visible, .sjp-media-library__new-folder:hover, .sjp-media-library__new-folder:focus-visible { outline: 3px solid #84c5f4; outline-offset: 1px; }
      .sjp-media-library__asset img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 8px; background: #f3f4f6; }
      .sjp-media-library__asset-name, .sjp-media-library__asset-path { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .sjp-media-library__asset-name { font-size: .85rem; font-weight: 600; }
      .sjp-media-library__asset-path { color: #717984; font-size: .75rem; }
      @media (max-width: 720px) {
        .sjp-media-library__panel { width: calc(100vw - 1rem); max-height: calc(100vh - 1rem); padding: 1rem; }
        .sjp-media-library__toolbar { grid-template-columns: 1fr 1fr; }
        .sjp-media-library__search { grid-column: 1 / -1; }
      }
    `;

    const grid = root.querySelector("[data-grid]");
    const folders = root.querySelector("[data-folders]");
    const breadcrumbs = root.querySelector("[data-breadcrumbs]");
    const status = root.querySelector("[data-status]");
    const searchInput = root.querySelector("[data-search]");
    const fileInput = root.querySelector("input[type='file']");
    const newFolderButton = root.querySelector("[data-new-folder]");

    const setStatus = (message) => {
      status.textContent = message;
    };

    const relativeToRoot = (path) => {
      const normalized = normalizePath(path);
      if (normalized === rootFolder) return "";
      return normalized.startsWith(`${rootFolder}/`) ? normalized.slice(rootFolder.length + 1) : normalized;
    };

    const itemsInCurrentFolder = () => {
      const prefix = `${currentFolder}/`;
      return allItems.filter((item) => {
        if (!item.path.startsWith(prefix)) return false;
        return !item.path.slice(prefix.length).includes("/");
      });
    };

    const immediateFolders = () => {
      const prefix = `${currentFolder}/`;
      const found = new Set();

      allItems.forEach((item) => {
        if (!item.path.startsWith(prefix)) return;
        const remainder = item.path.slice(prefix.length);
        const slashIndex = remainder.indexOf("/");
        if (slashIndex > 0) found.add(remainder.slice(0, slashIndex));
      });

      if (currentFolder === rootFolder && rootFolder === "/images/uploads") {
        suggestedUploadFolders.forEach((folder) => found.add(folder));
      }

      return [...found].sort((a, b) => a.localeCompare(b));
    };

    const renderBreadcrumbs = () => {
      breadcrumbs.innerHTML = "";
      const relative = relativeToRoot(currentFolder);
      const segments = relative ? relative.split("/") : [];
      const entries = [{ label: "All media", path: rootFolder }];
      let path = rootFolder;

      segments.forEach((segment) => {
        path = `${path}/${segment}`;
        entries.push({ label: titleFromSlug(segment), path });
      });

      entries.forEach((entry, index) => {
        if (index > 0) breadcrumbs.append(document.createTextNode("/"));
        const button = document.createElement("button");
        button.type = "button";
        button.className = "sjp-media-library__breadcrumb";
        button.textContent = entry.label;
        if (index === entries.length - 1) {
          button.setAttribute("aria-current", "page");
        } else {
          button.addEventListener("click", () => {
            currentFolder = entry.path;
            searchInput.value = "";
            render();
          });
        }
        breadcrumbs.append(button);
      });
    };

    const renderFolders = (searchTerm) => {
      folders.innerHTML = "";
      if (searchTerm) return;

      immediateFolders().forEach((folderName) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "sjp-media-library__folder";
        button.textContent = titleFromSlug(folderName);
        button.addEventListener("click", () => {
          currentFolder = `${currentFolder}/${folderName}`;
          render();
        });
        folders.append(button);
      });
    };

    const renderAssets = (searchTerm) => {
      grid.innerHTML = "";
      const term = searchTerm.trim().toLowerCase();
      const sourceItems = term
        ? allItems.filter((item) => `${item.name} ${relativeToRoot(item.path)}`.toLowerCase().includes(term))
        : itemsInCurrentFolder();
      const items = [...sourceItems].sort((a, b) => a.name.localeCompare(b.name));

      items.map(toAsset).forEach((asset) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "sjp-media-library__asset";
        button.title = asset.path;

        const img = document.createElement("img");
        img.src = asset.path;
        img.alt = "";
        img.loading = "lazy";

        const name = document.createElement("span");
        name.className = "sjp-media-library__asset-name";
        name.textContent = asset.name;

        const path = document.createElement("span");
        path.className = "sjp-media-library__asset-path";
        path.textContent = relativeToRoot(asset.path) || asset.path;

        button.append(img, name, path);
        button.addEventListener("click", () => chooseAsset(asset, handlers));
        grid.append(button);
      });

      if (term) {
        setStatus(items.length ? `${items.length} matching image${items.length === 1 ? "" : "s"}.` : "No images match that search.");
      } else {
        const folderCount = immediateFolders().length;
        const label = relativeToRoot(currentFolder) || "All media";
        setStatus(`${label}: ${items.length} image${items.length === 1 ? "" : "s"}${folderCount ? `, ${folderCount} categor${folderCount === 1 ? "y" : "ies"}` : ""}. Uploads will go here.`);
      }
    };

    const render = () => {
      const searchTerm = searchInput.value || "";
      renderBreadcrumbs();
      renderFolders(searchTerm.trim());
      renderAssets(searchTerm);
    };

    const refresh = async () => {
      setStatus("Loading assets…");
      const data = await requestJson(`/.netlify/functions/cdn-media?folder=${encodeURIComponent(rootFolder)}`);
      allItems = data.items || [];
      render();
    };

    root.querySelector("[data-close]").addEventListener("click", handlers.handleClose);
    root.addEventListener("click", (event) => {
      if (event.target === root) handlers.handleClose();
    });

    searchInput.addEventListener("input", render);

    newFolderButton.addEventListener("click", () => {
      const requested = window.prompt("Name this media category (for example: baptisms or christmas-2026)");
      if (!requested) return;
      const folderName = sanitizeFolderName(requested);
      if (!folderName) {
        setStatus("That category name is not valid.");
        return;
      }
      currentFolder = `${currentFolder}/${folderName}`;
      searchInput.value = "";
      render();
    });

    fileInput.addEventListener("change", async () => {
      const files = Array.from(fileInput.files || []);
      if (!files.length) return;

      try {
        setStatus(`Uploading ${files.length} image${files.length === 1 ? "" : "s"} to ${relativeToRoot(currentFolder) || "All media"}…`);
        for (const file of files) {
          await uploadAsset(file, currentFolder);
        }
        fileInput.value = "";
        await refresh();
      } catch (error) {
        setStatus(error.message);
      }
    });

    document.body.append(style, root);
    refresh().catch((error) => setStatus(error.message));
    window.setTimeout(() => searchInput.focus(), 0);

    return { root, style };
  };

  let dialog;

  const hideDialog = () => {
    dialog?.root.remove();
    dialog?.style.remove();
    dialog = undefined;
  };

  window.CMS.registerMediaLibrary({
    name: "cloudflare_netlify",
    init: ({ handleInsert }) => ({
      show: ({ config }) => {
        dialog = createDialog({
          config,
          handlers: {
            handleInsert,
            handleClose: hideDialog,
          },
        });
      },
      hide: hideDialog,
      enableStandalone: () => true,
    }),
  });
})();
