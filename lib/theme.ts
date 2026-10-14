export type ThemeMode = "light" | "dark";

export const THEME_STORAGE_KEY = "markition-crm-theme";
export const THEME_COOKIE_KEY = "markition-crm-theme";

export function resolveThemeMode(value?: string | null): ThemeMode {
  return value === "dark" ? "dark" : "light";
}

export function getThemeBootScript(storageKey = THEME_STORAGE_KEY, cookieKey = THEME_COOKIE_KEY) {
  return `(() => {
    try {
      var storageKey = ${JSON.stringify(storageKey)};
      var cookieKey = ${JSON.stringify(cookieKey)};
      var stored = window.localStorage.getItem(storageKey);
      var cookieMatch = document.cookie.split('; ').find(function (item) { return item.indexOf(cookieKey + '=') === 0; });
      var cookieValue = cookieMatch ? cookieMatch.split('=')[1] : null;
      var theme = stored === 'dark' || stored === 'light' ? stored : cookieValue === 'dark' ? 'dark' : 'light';
      var root = document.documentElement;
      root.classList.toggle('dark', theme === 'dark');
      root.dataset.theme = theme;
      root.style.colorScheme = theme;
      window.localStorage.setItem(storageKey, theme);
      document.cookie = cookieKey + '=' + theme + '; path=/; max-age=31536000; samesite=lax';
    } catch (error) {}
  })();`;
}
