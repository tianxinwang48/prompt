// ==UserScript==
// @name         Prompt 助手面板
// @namespace    AI_namespace
// @version      1.0
// @description  提示词模板助手（适配chatgpt、deepseek），支持自定义模版录入、删除、批量导入导出，模版支持变量定义，优化自定义输入弹窗
// @description:zh  提示词模板助手（适配chatgpt、deepseek），支持自定义模版录入、删除、批量导入导出，模版支持变量定义
// @description:zh-TW  提示詞模板助手（適配chatgpt、deepseek），支持自定義模版錄入、刪除、批量導入導出，模版支持變量定義
// @author       tianxinwang48
// @match        https://chatgpt.com/*
// @match        https://*.deepseek.com/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const STORAGE_KEY = 'prompt_templates_v2';
    const STATE_KEY = 'prompt_panel_open';

    const defaultTemplates = [
        { name: '代码重构建议', prompt: '以下这段 Java 代码存在可维护性或可读性问题，请给出重构建议并示例重构后的代码：\n```java\n{原始代码}\n```' },
        { name: '性能优化分析', prompt: '请分析下面 Java 服务的性能瓶颈，并给出具体的优化方案（CPU、内存、GC、I/O 等）：\n```text\n{服务描述或日志片段}\n```' },
        { name: '设计模式应用', prompt: '在以下业务场景中，推荐并说明适合使用的设计模式，并给出示例代码：\n场景：{业务场景描述}' },
        { name: 'JPA 实体映射', prompt: '请基于下面数据库表结构生成对应的 JPA 实体类代码，并添加常用注解：\n```sql\n{建表语句}\n```' },
        { name: '异常排查', prompt: '请分析以下 Java 堆栈跟踪，定位异常原因并给出可能的解决方法：\n```text\n{异常堆栈}\n```' }
    ];

    function getTemplates() {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : defaultTemplates;
    }

    function saveTemplates(templates) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
    }

    function showInputModal(keys) {
        return new Promise(resolve => {
            const mask = document.createElement('div');
            mask.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:10000;';

            // 创建对话框
            const box = document.createElement('div');
            box.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:400px;background:#fff;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.3);padding:16px;font-family:sans-serif;';

            // 标题
            const title = document.createElement('div');
            title.textContent = '请输入变量值';
            title.style.cssText = 'font-size:18px;font-weight:bold;margin-bottom:12px;';
            box.appendChild(title);

            // 表单
            const form = document.createElement('div');
            keys.forEach(key => {
                const label = document.createElement('label');
                label.textContent = key;
                label.style.cssText = 'display:block;margin-top:8px;font-weight:500;';
                const textarea = document.createElement('textarea');
                textarea.dataset.key = key;
                textarea.style.cssText = 'width:100%;height:60px;margin-top:4px;padding:6px;border:1px solid #ccc;border-radius:4px;resize:vertical;';
                form.appendChild(label);
                form.appendChild(textarea);
            });
            box.appendChild(form);

            const btnWrap = document.createElement('div');
            btnWrap.style.cssText = 'text-align:right;margin-top:12px;';
            const okBtn = document.createElement('button');
            okBtn.textContent = '确定';
            okBtn.style.cssText = 'margin-right:8px;padding:6px 12px;background:#10a37f;color:#fff;border:none;border-radius:4px;cursor:pointer;';
            const cancelBtn = document.createElement('button');
            cancelBtn.textContent = '取消';
            cancelBtn.style.cssText = 'padding:6px 12px;background:#ccc;color:#333;border:none;border-radius:4px;cursor:pointer;';
            btnWrap.appendChild(okBtn);
            btnWrap.appendChild(cancelBtn);
            box.appendChild(btnWrap);

            mask.appendChild(box);
            document.body.appendChild(mask);

            cancelBtn.addEventListener('click', () => {
                document.body.removeChild(mask);
                resolve(null);
            });
            okBtn.addEventListener('click', () => {
                const result = {};
                form.querySelectorAll('textarea').forEach(ta => {
                    result[ta.dataset.key] = ta.value;
                });
                document.body.removeChild(mask);
                resolve(result);
            });
        });
    }

    async function replacePlaceholders(template) {
        const keys = Array.from(template.match(/{(.*?)}/g) || []).map(s => s.slice(1, -1));
        if (!keys.length) return template;
        const values = await showInputModal(keys);
        if (!values) return null;
        let str = template;
        keys.forEach(k => {
            const re = new RegExp(`\\{${k}\\}`, 'g');
            str = str.replace(re, values[k] || `{${k}}`);
        });
        return str;
    }

    function insertPrompt(text) {
        let input = document.querySelector('div[contenteditable="true"]') || document.querySelector('textarea');
        if (!input) { console.warn('找不到输入框'); return; }
        input.focus();
        if (input.tagName.toLowerCase() === 'textarea') {
            const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
            setter.call(input, text);
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
            document.execCommand('selectAll', false, null);
            document.execCommand('insertText', false, text);
            input.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, data: text, inputType: 'insertText' }));
        }
        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    function createPanel() {
        const existing = document.getElementById('prompt-helper-panel');
        if (existing) existing.remove();
        const panel = document.createElement('div');
        panel.id = 'prompt-helper-panel';
        panel.style.cssText = 'position:fixed;bottom:70px;right:20px;width:320px;background:#f9f9f9;border:1px solid #ccc;border-radius:12px;box-shadow:0 4px 16px rgba(0,0,0,0.12);padding:12px;z-index:9999;font-family:sans-serif;';
        const templates = getTemplates();
        const site = location.hostname.includes('deepseek') ? 'DeepSeek' : 'ChatGPT';
        const listHtml = templates.map((t,i) =>
                                       `<li style="margin-bottom:8px;display:flex;gap:4px;"><button data-id="${i}" class="template-btn" style="flex:1;padding:6px;border:1px solid #ddd;border-radius:4px;background:#fff;cursor:pointer;text-align:left;">${t.name}</button><button data-del="${i}" style="color:red;border:none;background:none;cursor:pointer;">✖</button></li>`
        ).join('');
        panel.innerHTML = `<div style="font-weight:bold;font-size:16px;margin-bottom:10px;">🎯 Prompt 模板（${site}）</div><ul id="template-list" style="list-style:none;padding:0;max-height:300px;overflow-y:auto;">${listHtml}</ul>`;
        document.body.appendChild(panel);

        panel.querySelectorAll('button[data-id]').forEach(btn => {
            btn.addEventListener('click', async e => {
                const tpl = templates[e.target.dataset.id];
                const filled = await replacePlaceholders(tpl.prompt);
                if (filled) insertPrompt(filled);
            });
        });
        panel.querySelectorAll('button[data-del]').forEach(btn => {
            btn.addEventListener('click', e => {
                if (confirm(`确认删除模板【${templates[e.target.dataset.del].name}】吗？`)) {
                    templates.splice(e.target.dataset.del,1);
                    saveTemplates(templates);
                    createPanel();
                }
            });
        });

        const wrap = document.createElement('div');
        wrap.style.cssText='margin-top:8px;display:flex;gap:4px;';
        ['添加','导入','导出'].forEach(label=>{
            const btn=document.createElement('button');
            btn.textContent=label+'模板';
            btn.style.cssText='flex:1;padding:6px;border:none;border-radius:4px;cursor:pointer;background:#10a37f;color:#fff;';
            wrap.appendChild(btn);
            if(label==='添加'){
                btn.onclick=()=>{const name=prompt('模板名称');const promptText=prompt('提示词内容（支持 {变量}）');if(name&&promptText){templates.push({name,prompt:promptText});saveTemplates(templates);createPanel();}};
            } else if(label==='导入'){
                btn.onclick=()=>{const inp=document.createElement('input');inp.type='file';inp.accept='application/json';inp.onchange=()=>{const f=inp.files[0];if(f){const r=new FileReader();r.onload=e=>{try{const j=JSON.parse(e.target.result);if(Array.isArray(j)){saveTemplates(j);alert('导入成功');createPanel();}else alert('格式无效');}catch{alert('JSON解析失败');}};r.readAsText(f);}};inp.click();};
            } else {
                btn.onclick=()=>{const b=new Blob([JSON.stringify(templates,null,2)],{type:'application/json'});const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download='prompt_templates.json';a.click();URL.revokeObjectURL(u);};
            }
        });
        panel.appendChild(wrap);
        localStorage.setItem(STATE_KEY,'open');
    }

    function createToggleButton() {
        const btn=document.createElement('button');btn.id='prompt-toggle-btn';btn.textContent='🧠 Prompt';
        btn.style.cssText='position:fixed;bottom:20px;right:20px;padding:10px 16px;border-radius:24px;border:none;background:#10a37f;color:#fff;font-size:14px;cursor:pointer;z-index:9999;';
        btn.onclick=()=>{const p=document.getElementById('prompt-helper-panel');if(p){p.remove();localStorage.setItem(STATE_KEY,'closed');}else createPanel();};
        document.body.appendChild(btn);
    }

    window.addEventListener('load',()=>{setTimeout(()=>{createToggleButton();if(localStorage.getItem(STATE_KEY)==='open')createPanel();},1000);});
})();
