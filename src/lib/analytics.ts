
export const trackPageView = (activePage: string, subCategory?: string | null) => {
  if (typeof window !== 'undefined') {
    const pageName = subCategory ? `${activePage} - ${subCategory}` : activePage;
    const fullTitle = `${pageName} | KeenVi Studio`;
    
    // 브라우저 탭 제목 업데이트 (GA4가 이 값을 참조함)
    document.title = fullTitle;

    if ((window as any).gtag) {
      // 1. screen_view 이벤트 전송
      (window as any).gtag('event', 'screen_view', {
        app_name: 'KeenVi Studio',
        screen_name: pageName,
      });

      // 2. page_view 이벤트 명시적 전송 (페이지 제목 보고서 최적화)
      (window as any).gtag('event', 'page_view', {
        page_title: fullTitle,
        page_location: window.location.href,
        page_path: window.location.pathname + '#' + pageName.toLowerCase().replace(/\s+/g, '-')
      });
    }
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
