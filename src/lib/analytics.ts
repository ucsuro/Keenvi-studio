
export const trackPageView = (activePage: string, subCategory?: string | null) => {
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', 'screen_view', {
      app_name: 'KeenVi Studio',
      screen_name: subCategory ? `${activePage} - ${subCategory}` : activePage,
    });
  }
};

export const trackImageClick = (title: string) => {
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', 'select_content', {
      content_type: 'image',
      item_id: title,
    });
  }
};
