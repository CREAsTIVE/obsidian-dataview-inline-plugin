
import { Editor, MarkdownView, Notice, Plugin, TAbstractFile, TFile } from 'obsidian';

import { DataviewApi, getAPI } from 'obsidian-dataview';

// https://regex101.com/r/i9dmNu/4
const matchDataviewCodeblockRegex = /```inline dataview\n((?:[\s\S](?!```))*)\n```(?:\n*<!--DATAVIEW INLINE START-->(?:[\s\S](?!<!--))*\n<!--DATAVIEW INLINE END-->)?/g;

async function replaceAsync(string: string, regexp: RegExp, replacerFunction: (...args: unknown[]) => Promise<string>) {
    const replacements = await Promise.all(
        Array.from(string.matchAll(regexp),
            match => replacerFunction(...match)));
    let i = 0;
    return string.replace(regexp, () => replacements[i++]);
}

export default class DataviewInlinePlugin extends Plugin {
	modifiedFiles: Set<TAbstractFile> = new Set();
	files: Set<TAbstractFile> = new Set();
	dataviewAPI: DataviewApi;

	async updateFile(file: TAbstractFile) {
		if (!(file instanceof TFile)) {return;}

		let fileContent = await file.vault.read(file);

		fileContent = await replaceAsync(fileContent, matchDataviewCodeblockRegex, async (substr, content: string) => {
			const codeblock = `\`\`\`inline dataview\n${content}\n\`\`\``;
			const rendered = await this.dataviewAPI.tryQueryMarkdown(content, fileContent);
			return `${codeblock}\n<!--DATAVIEW INLINE START-->\n\n${rendered}\n<!--DATAVIEW INLINE END-->`
		});

		this.modifiedFiles.add(file);
		file.vault.modify(file, fileContent);
	}

	async sheduleFileUpdate(file: TAbstractFile): Promise<void> {
		if (this.modifiedFiles.has(file)) {
			this.modifiedFiles.delete(file);
			return;
		}
		this.files.add(file)
	}
	
	async onload() {
		const dataviewAPI = getAPI(this.app);

		if (!dataviewAPI) {
			const errMessage = 'The Dataview plugin is not installed or enabled. Please make sure it is installed and enabled, then restart Obsidian';
			console.log(errMessage);
			new Notice(errMessage, 0);
			return;
		}

		this.dataviewAPI = dataviewAPI;

		this.registerEvent(
			this.app.vault.on("modify", (file) => this.sheduleFileUpdate(file))
		)

		this.addCommand({
			id: 'dataview-inline-scan',
			name: 'Scan',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				if (view.file) {
					this.updateFile(view.file)
				}
			}
		});
		
		this.registerInterval(window.setInterval(() => {
			this.files.forEach(file => this.updateFile(file))
			this.files.clear();
		}, 2000))
	}

	

	onunload() {

	}
}
