(() => {
  const mediaPathPrefixes = ["/images/uploads", "/images/profile-photos"];

  const normalizePath = (path) => {
    if (!path) return "/images/uploads";
    return path.startsWith("/") ? path : `/${path}`;
  };

  const isManagedPath = (path) =>
    mediaPathPrefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));

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
    const folder = isManagedPath(configuredFolder) ? configuredFolder : "/images/uploads";
    const root = document.createElement("div");
    root.className = "sjp-media-library";
    root.innerHTML = `
      <div class="sjp-media-library__panel" role="dialog" aria-modal="true" aria-label="Cloudflare media library">
        <header class="sjp-media-library__header">
          <div>
            <strong>Cloudflare media library</strong>
            <p>Images keep their existing site paths and are served through Netlify.</p>
          </div>
          <button type="button" data-close aria-label="Close media library">×</button>
        </header>
        <label class="sjp-media-library__upload">
          <span>Upload image</span>
          <input type="file" accept="image/*" multiple />
        </label>
        <p class="sjp-media-library__status" data-status>Loading assets…</p>
        <div class="sjp-media-library__grid" data-grid></div>
      </div>
    `;

    const style = document.createElement("style");
    style.textContent = `
      .sjp-media-library { position: fixed; inset: 0; z-index: 10000; display: grid; place-items: center; background: rgba(0, 0, 0, 0.48); font-family: system-ui, sans-serif; }
      .sjp-media-library__panel { width: min(960px, calc(100vw - 2rem)); max-height: min(760px, calc(100vh - 2rem)); overflow: auto; background: #fff; border-radius: 16px; box-shadow: 0 24px 90px rgba(0, 0, 0, 0.28); padding: 1.25rem; }
      .sjp-media-library__header { display: flex; align-items: start; justify-content: space-between; gap: 1rem; margin-bottom: 1rem; }
      .sjp-media-library__header p { margin: .25rem 0 0; color: #58606b; }
      .sjp-media-library__header button { border: 0; background: #f0f1f3; border-radius: 999px; width: 2rem; height: 2rem; font-size: 1.35rem; cursor: pointer; }
      .sjp-media-library__upload { display: inline-flex; align-items: center; gap: .75rem; border: 1px dashed #87909c; border-radius: 12px; padding: .85rem 1rem; cursor: pointer; margin-bottom: 1rem; }
      .sjp-media-library__upload input { max-width: 18rem; }
      .sjp-media-library__status { color: #58606b; }
      .sjp-media-library__grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: .85rem; }
      .sjp-media-library__asset { display: grid; gap: .5rem; border: 1px solid #e1e4e8; background: #fff; border-radius: 12px; padding: .5rem; cursor: pointer; text-align: left; }
      .sjp-media-library__asset:hover, .sjp-media-library__asset:focus-visible { outline: 3px solid #84c5f4; outline-offset: 1px; }
      .sjp-media-library__asset img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 8px; background: #f3f4f6; }
      .sjp-media-library__asset span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: .85rem; }
    `;

    const grid = root.querySelector("[data-grid]");
    const status = root.querySelector("[data-status]");
    const fileInput = root.querySelector("input[type='file']");

    const setStatus = (message) => {
      status.textContent = message;
    };

    const renderAssets = (items) => {
      grid.innerHTML = "";
      items.map(toAsset).forEach((asset) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "sjp-media-library__asset";
        button.innerHTML = `<img src="${asset.path}" alt="" loading="lazy"><span title="${asset.name}">${asset.name}</span>`;
        button.addEventListener("click", () => chooseAsset(asset, handlers));
        grid.append(button);
      });
      setStatus(items.length ? `${items.length} assets available.` : "No assets found yet.");
    };

    const refresh = async () => {
      setStatus("Loading assets…");
      const data = await requestJson(`/.netlify/functions/cdn-media?folder=${encodeURIComponent(folder)}`);
      renderAssets(data.items || []);
    };

    root.querySelector("[data-close]").addEventListener("click", handlers.handleClose);
    root.addEventListener("click", (event) => {
      if (event.target === root) handlers.handleClose();
    });

    fileInput.addEventListener("change", async () => {
      const files = Array.from(fileInput.files || []);
      if (!files.length) return;

      try {
        setStatus(`Uploading ${files.length} image${files.length === 1 ? "" : "s"}…`);
        for (const file of files) {
          await uploadAsset(file, folder);
        }
        fileInput.value = "";
        await refresh();
      } catch (error) {
        setStatus(error.message);
      }
    });

    document.body.append(style, root);
    refresh().catch((error) => setStatus(error.message));

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
