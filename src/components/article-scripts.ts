/**
 * article-scripts.ts
 * 
 * Contains all JavaScript code strings that are injected into the WebView.
 * These scripts run in the context of the rendered article page.
 */

import intl from "react-intl-universal"

/**
 * Injects code block styling into the WebView
 */
export function getCodeBlockStylesScript(): string {
    return `(() => {
        const id = 'ai-code-styles';
        if (document.getElementById(id)) return true;
        const style = document.createElement('style');
        style.id = id;
        style.textContent = \`
            article pre {
                background-color: var(--summary-bg, #f3f2f1);
                border-radius: 6px;
                padding: 12px 16px;
                overflow-x: auto;
                border: 1px solid var(--spinner-bg, #e0e0e0);
                margin: 1em 0;
            }
            article code {
                background-color: rgba(128, 128, 128, 0.1);
                padding: 2px 5px;
                border-radius: 4px;
                font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
                font-size: 0.9em;
            }
            article pre code {
                background-color: transparent;
                padding: 0;
                border-radius: 0;
                color: inherit;
                font-size: inherit;
            }
            @media (prefers-color-scheme: dark) {
                article pre {
                    background-color: #2d2d30;
                    border-color: #3e3e42;
                }
                article code {
                    background-color: rgba(255, 255, 255, 0.1);
                }
                article pre code {
                    background-color: transparent;
                }
            }
        \`;
        document.head.appendChild(style);
        return true;
    })()`
}

/**
 * Injects or updates the AI summary box in the article
 */
export function getInjectSummaryScript(summary: string): string {
    const safe = JSON.stringify(String(summary || ""))
    return `(() => {
        const root = document.getElementById('main') || document.body;
        if (!root) {
            console.error('[AI] No root element for summary injection');
            return false;
        }
        const article = root.querySelector('article');
        let box = root.querySelector('.ai-summary');
        if (!box) {
            box = document.createElement('div');
            box.className = 'ai-summary';
            box.style.cssText = 'background-color:var(--summary-bg, #f3f2f1);padding:12px 16px;margin:12px 0;border-radius:4px;border-left:4px solid var(--primary, #0078d4)';
            const title = document.createElement('div');
            title.style.cssText = 'font-weight:600;margin-bottom:8px;color:var(--primary, #0078d4);';
            title.textContent = '💡 ' + ${JSON.stringify(intl.get("ai.summary"))};
            const contentEl = document.createElement('div');
            contentEl.className = 'ai-summary-content';
            contentEl.style.cssText = 'line-height:1.6;white-space:pre-wrap;';
            box.appendChild(title);
            box.appendChild(contentEl);
            if (article && article.parentNode) {
                article.parentNode.insertBefore(box, article);
            } else {
                root.appendChild(box);
            }
        }
        const content = box.querySelector('.ai-summary-content');
        if (content) {
            content.textContent = ${safe};
        }
        return true;
    })()`
}

/**
 * Injects the title translation below the article title
 */
export function getInjectTitleTranslationScript(titleTranslation: string): string {
    const safe = JSON.stringify(String(titleTranslation || ""))
    return `(() => {
        const root = document.getElementById('main') || document.body;
        if (!root) {
            console.error('[AI] No root element for title translation');
            return false;
        }
        const titleEl = root.querySelector('.title');
        if (!titleEl) {
            console.warn('[AI] Title element not found');
            return false;
        }
        // Remove existing title translation
        let existingTranslation = titleEl.querySelector('.title-translation');
        if (existingTranslation) {
            existingTranslation.remove();
        }
        // Create title translation element
        const translationEl = document.createElement('span');
        translationEl.className = 'title-translation';
        translationEl.style.cssText = 'display:block;color:var(--gray, #666);font-size:0.85em;font-style:italic;margin-top:8px;line-height:1.5;font-weight:normal;';
        translationEl.textContent = ${safe};
        titleEl.appendChild(translationEl);
        return true;
    })()`
}

/**
 * Marks paragraphs with data attributes and returns their HTML for translation
 */
export function getMarkParagraphsScript(): string {
    return `(() => {
        const root = document.querySelector('article') || document.getElementById('main') || document.body;
        if (!root) return [];
        
        // Check if element is a container (has block children)
        const isContainer = (el) => {
            if (el.querySelector('p,h1,h2,h3,h4,h5,h6,li,blockquote,td,th,ul,ol,table,article,section')) return true;
            const childDivs = el.querySelectorAll('div');
            for (const div of childDivs) {
                if (div.innerText.trim().length > 10) return true;
            }
            return false;
        };

        const blocks = root.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote, td, th, div, section, span');
        let idx = 0;
        const texts = [];
        
        for (const el of Array.from(blocks)) {
            if (!el || !(el instanceof HTMLElement)) continue;
            
            // Skip translation results, AI summary, and hidden elements
            if (el.closest('.ai-translation') || el.closest('.ai-summary')) continue;
            if (el.style.display === 'none' || el.style.visibility === 'hidden') continue;
            
            // Skip code blocks
            if (el.closest('pre')) continue;
            if (el.tagName.toLowerCase() === 'pre') continue;

            const tag = el.tagName.toLowerCase();
            
            // For div/section/span/blockquote/li, check if it's only a container
            if (['div', 'section', 'span', 'blockquote', 'li'].includes(tag)) {
                 if (el.querySelector('pre')) {
                     if (isContainer(el)) continue;
                 }
                 
                 if (isContainer(el)) continue;
                 
                 if (el.innerText.replace(/\\s+/g,'').trim().length < 10) continue;
            }

            // Avoid duplicates: skip if parent is already marked
            if (el.parentElement && el.parentElement.closest('[data-ai-para-index]')) continue;
            
            let txt = elementText(el);
            if (txt.length >= 10) {
                el.setAttribute('data-ai-para-index', String(idx));
                texts.push(el.innerHTML || '');
                idx++;
            }
        }
        
        function elementText(el) {
            return (el.innerText || '').replace(/\\s+/g,' ').trim();
        }

        return texts;
    })()`
}

/**
 * Inserts translated text after a marked paragraph
 */
export function getInsertTranslationScript(index: number, translated: string): string {
    const safe = JSON.stringify(String(translated || ""))
    return `(() => {
        const el = document.querySelector('[data-ai-para-index="' + ${index} + '"]');
        if (!el) {
            console.warn('[AI] Paragraph with index', ${index}, 'not found');
            return false;
        }
        // Remove all existing adjacent translation blocks
        let next = el.nextSibling;
        while (next) {
            if (next.nodeType === 1 && next.classList.contains('ai-translation')) {
                const toRemove = next;
                next = next.nextSibling;
                toRemove.remove();
                continue;
            }
            if (next.nodeType === 3 && !next.textContent.trim()) {
                next = next.nextSibling;
                continue;
            }
            break;
        }
        const div = document.createElement('div');
        div.className = 'ai-translation';
        div.style.cssText = 'color:var(--gray, #666);font-style:italic;margin:4px 0 12px 0;padding:0;font-size:0.95em;line-height:1.7;opacity:0.85;';
        const html = ${safe};
        const tmp = document.createElement('div');
        tmp.innerHTML = html;
        for (const bad of Array.from(tmp.querySelectorAll('script,style,iframe'))) bad.remove();
        for (const n of Array.from(tmp.querySelectorAll('*'))) {
            for (const a of Array.from(n.attributes)) {
                if (/^on/i.test(a.name)) n.removeAttribute(a.name);
            }
        }
        div.innerHTML = tmp.innerHTML;
        if (el.parentNode) el.parentNode.insertBefore(div, el.nextSibling);
        return true;
    })()`
}

/**
 * Appends a global translation block at the end of the article (fallback)
 */
export function getAppendGlobalTranslationScript(translated: string): string {
    const safe = JSON.stringify(String(translated || ""))
    return `(() => {
        const root = document.querySelector('article') || document.getElementById('main') || document.body;
        if (!root) return false;
        let box = document.getElementById('ai-translation-global');
        if (!box) {
            box = document.createElement('div');
            box.id = 'ai-translation-global';
            box.className = 'ai-translation';
            box.style.cssText = 'color:var(--gray, #666);font-style:italic;margin:8px 0 16px 0;padding:0;font-size:0.95em;line-height:1.7;opacity:0.85;';
            root.appendChild(box);
        }
        const html = ${safe};
        const tmp = document.createElement('div');
        tmp.innerHTML = html;
        for (const bad of Array.from(tmp.querySelectorAll('script,style,iframe'))) bad.remove();
        for (const n of Array.from(tmp.querySelectorAll('*'))) {
            for (const a of Array.from(n.attributes)) {
                if (/^on/i.test(a.name)) n.removeAttribute(a.name);
            }
        }
        box.innerHTML = tmp.innerHTML;
        return true;
    })()`
}

/**
 * Toggles visibility of translation elements
 */
export function getSetTranslationVisibilityScript(show: boolean): string {
    return `(() => {
        // Control paragraph translations
        const nodes = document.querySelectorAll('.ai-translation');
        for (const n of Array.from(nodes)) {
            n.style.display = ${show ? "''" : "'none'"};
        }
        // Control title translation
        const titleTranslation = document.querySelector('.title-translation');
        if (titleTranslation) {
            titleTranslation.style.display = ${show ? "'block'" : "'none'"};
        }
        return true;
    })()`
}

/**
 * Shows or hides the translation loading spinner
 */
export function getTranslationSpinnerScript(show: boolean): string {
    if (show) {
        return `(() => {
            const root = document.querySelector('article') || document.getElementById('main') || document.body;
            if (!root) return false;
            let loader = document.getElementById('ai-translation-loader');
            if (loader) { loader.style.display = 'flex'; return true; }
            loader = document.createElement('div');
            loader.id = 'ai-translation-loader';
            loader.style.cssText = 'display:flex;align-items:center;justify-content:center;margin:12px 0 20px 0;';
            const circle = document.createElement('div');
            circle.style.cssText = 'width:16px;height:16px;border:2px solid var(--spinner-bg, #e0e0e0);border-top-color:var(--primary, #0078d4);border-radius:50%;animation:aiSpin 0.8s linear infinite;';
            let style = document.getElementById('ai-translation-style');
            if (!style) {
                style = document.createElement('style');
                style.id = 'ai-translation-style';
                style.textContent = '@keyframes aiSpin { to { transform: rotate(360deg); } }';
                root.appendChild(style);
            }
            loader.appendChild(circle);
            root.appendChild(loader);
            return true;
        })()`
    } else {
        return `(() => { const n = document.getElementById('ai-translation-loader'); if (n) n.remove(); const s = document.getElementById('ai-translation-style'); if (s) s.remove(); return true; })()`
    }
}

/**
 * Cleans up all injected translation elements and data attributes
 */
export function getCleanupTranslationsScript(): string {
    return `(() => {
        // Remove translation display elements
        const translations = document.querySelectorAll('.ai-translation, .title-translation, #ai-translation-loader');
        translations.forEach(el => el.remove());
        
        // Remove paragraph markers to prevent logic interference
        const marked = document.querySelectorAll('[data-ai-para-index]');
        marked.forEach(el => el.removeAttribute('data-ai-para-index'));
        
        return true;
    })()`
}

/**
 * Checks if the article is ready for injection (has content rendered)
 */
export function getIsArticleReadyScript(): string {
    return `(() => {
        const root = document.querySelector('article') || document.getElementById('main') || document.body;
        if (!root) return false;
        const main = document.getElementById('main');
        if (main && main.classList && main.classList.contains('show')) return true;
        const text = (root.innerText || '').replace(/\\s+/g,' ').trim();
        if (text.length >= 20) return true;
        const blocks = root.querySelectorAll('p,h1,h2,h3,h4,h5,h6,li,blockquote,td,th');
        return blocks.length > 0;
    })()`
}

/**
 * Waits for the article to be ready with MutationObserver and polling
 */
export function getWaitForArticleReadyScript(timeoutMs: number = 12000, pollMs: number = 200): string {
    return `(() => {
        return new Promise(resolve => {
            const done = () => { resolve(true); };
            const isReady = () => {
                const root = document.querySelector('article') || document.getElementById('main') || document.body;
                if (!root) {
                    return false;
                }
                const main = document.getElementById('main');
                if (main && main.classList && main.classList.contains('show')) {
                    return true;
                }
                const text = (root.innerText || '').replace(/\\s+/g,' ').trim();
                if (text.length >= 20) {
                    return true;
                }
                const blocks = root.querySelectorAll('p,h1,h2,h3,h4,h5,h6,li,blockquote,td,th');
                if (blocks.length > 0) {
                    return true;
                }
                return false;
            };
            if (isReady()) return done();
            let observer = null;
            try {
                if (window.MutationObserver) {
                    observer = new MutationObserver(() => {
                        if (isReady()) {
                            if (observer) observer.disconnect();
                            done();
                        }
                    });
                    observer.observe(document.documentElement, {
                        subtree: true,
                        childList: true,
                        attributes: true,
                        attributeFilter: ['class']
                    });
                }
            } catch (e) {
                console.warn('[AI] MutationObserver setup failed:', e);
            }
            const interval = setInterval(() => {
                if (isReady()) {
                    clearInterval(interval);
                    if (observer) observer.disconnect();
                    done();
                }
            }, ${pollMs});
            setTimeout(() => {
                clearInterval(interval);
                if (observer) observer.disconnect();
                console.warn('[AI] Article ready timeout after ' + ${timeoutMs} + ' ms');
                resolve(false);
            }, ${timeoutMs});
        });
    })()`
}

/**
 * Gets the full HTML of the article root
 */
export function getRootHTMLScript(): string {
    return `(() => {
        const root = document.querySelector('article') || document.getElementById('main') || document.body;
        if (!root) return '';
        const main = document.getElementById('main');
        if (main) return main.innerHTML || '';
        const art = document.querySelector('article');
        if (art) return art.innerHTML || '';
        return document.body.innerHTML || '';
    })()`
}
