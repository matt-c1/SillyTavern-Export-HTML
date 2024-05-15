import { registerSlashCommand } from "../../../slash-commands.js";
import { Progress } from "./Progress.js";

const log = (...msg) => console.log('[XH]', ...msg);

const imgCache = {};
const getCachedImg = async(url) => {
	if (!imgCache[url]) {
		await new Promise(resolve => {
			const img = new Image();
			img.addEventListener('load', () => {
				const canvas = document.createElement('canvas');
				canvas.width = img.naturalWidth;
				canvas.height = img.naturalHeight;
				const ctx = canvas.getContext('2d');
				ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight);
				imgCache[url] = canvas.toDataURL();
				resolve();
			});
			img.addEventListener('error', resolve);
			img.src = url;
		});
	}
	return imgCache[url];
};

const generateClassName = (styles) => {
	let hash = 5381;
	for (let i = 0; i < styles.length; i++) {
		for (let j = 0; j < styles[i].length; j++) {
			hash = ((hash << 5) + hash) + styles[i].charCodeAt(j);
		}
	}
	return 'class-' + hash.toString(36);
};

const collectStyles = (el, uniqueStyles) => {
	const style = window.getComputedStyle(el);
	const styles = [];
	for (const key of style) {
		const val = style.getPropertyValue(key);
		if (val !== '') {
			styles.push(`${key}:${val}`);
		}
	}
	const className = generateClassName(styles);
	if (!uniqueStyles[className]) {
		uniqueStyles[className] = styles;
	}
	return className;
};

const applyComputedStyle = async(el, clone, uniqueStyles) => {
	const className = collectStyles(el, uniqueStyles);
	clone.setAttribute('class', className);
	if (el.tagName === 'IMG') {
		clone.src = await getCachedImg(el.src);
	}
};

const cleanQuotedText = (text) => {
	return text.replace(/^"|"$/g, '').replace(/“|”/g, '');
};

const exportChatAsHtml = async() => {
	log('EXPORT HTML');
	const prog = new Progress();
	prog.render();
	const root = document.querySelector('#chat');
	const clone = root.cloneNode(true);
	clone.style.height = '100vh';
	clone.style.overflow = 'auto';
	const els = Array.from(root.querySelectorAll('*'));
	const clones = Array.from(clone.querySelectorAll('*'));
	log('els', els.length);
	prog.max = els.length;

	const uniqueStyles = {};
	for (let i = 0; i < els.length; i++) {
		prog.cur = i + 1;
		await applyComputedStyle(els[i], clones[i], uniqueStyles);
	}

	let cssContent = '';
	for (const className in uniqueStyles) {
		const styles = uniqueStyles[className];
		cssContent += `.${className} { ${styles.join('; ')}; }\n`;
	}

	const bgCustom = window.getComputedStyle(document.querySelector('#bg_custom')).getPropertyValue('background-image');
	const bg1 = window.getComputedStyle(document.querySelector('#bg1')).getPropertyValue('background-image');
	let bg;
	if (!bgCustom || bgCustom === 'none') {
		bg = await getCachedImg(bg1.replace(/^.*url\(['"]?([^)'"]+)['"]?\).*$/, '$1'));
	} else {
		bg = await getCachedImg(bgCustom.replace(/^.*url\(['"]?([^)'"]+)['"]?\).*$/, '$1'));
	}

	// Clean quoted text
	Array.from(clone.querySelectorAll('q')).forEach(q => {
		q.innerHTML = cleanQuotedText(q.innerHTML);
	});

	const htmlContent = `
		<html style="margin:0;padding:0;background-image:url('${bg}');background-repeat:no-repeat;background-size:cover;">
			<head>
				<style>
					${cssContent}
				</style>
			</head>
			<body style="margin:0;padding:0;">
				${clone.outerHTML}
			</body>
		</html>
	`;

	const blob = new Blob([htmlContent], { type: 'text/html' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = 'SillyTavern-Chat.html';
	a.click();
	log('DONE!', clone);
	prog.remove();
};

registerSlashCommand('exportHtml', exportChatAsHtml, ['eh'], 'Export current chat as a HTML document.');
