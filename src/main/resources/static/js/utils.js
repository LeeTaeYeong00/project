// 📍 커서를 블록의 맨 끝으로 이동
export function moveCursorToEnd(element) {
    if (!element) return;
    
    element.focus();
    const selection = window.getSelection();
    const range = document.createRange();
    
    if (element.hasChildNodes()) {
        let lastNode = element.lastChild;
        
        while (lastNode && lastNode.nodeType === Node.TEXT_NODE && lastNode.textContent === '') {
            lastNode = lastNode.previousSibling;
        }
        
        if (lastNode) {
            if (lastNode.nodeType === Node.TEXT_NODE) {
                range.setStart(lastNode, lastNode.textContent.length);
            } else {
                range.setStartAfter(lastNode);
            }
        } else {
            range.setStart(element, 0);
        }
    } else {
        range.selectNodeContents(element);
    }
    
    range.collapse(true); 
    selection.removeAllRanges();
    selection.addRange(range);
}

// 📍 커서를 블록의 맨 앞으로 이동
export function moveCursorToStart(element) {
    try {
        const range = document.createRange();
        const selection = window.getSelection();
        range.selectNodeContents(element);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
    } catch (e) { console.error(e); }
}