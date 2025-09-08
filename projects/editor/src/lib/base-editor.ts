import { AfterViewInit, ElementRef, EventEmitter, Inject, Input, OnDestroy, Output, ViewChild } from '@angular/core';
import { fromEvent, Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { NGX_MONACO_EDITOR_CONFIG, NgxMonacoEditorConfig } from './config';

let loadedMonaco = false;
let loadPromise: Promise<void>;

export abstract class BaseEditor implements AfterViewInit, OnDestroy {

  @ViewChild('editorContainer', { static: true }) _editorContainer: ElementRef;

  @Input() i18nLang = 'en';
  @Input() resizeDebounceTimeMs = 250;

  @Output() onInit = new EventEmitter<any>();

  protected _editor: any;
  protected _options: any;
  protected _windowResizeSubscription: Subscription;

  constructor(protected config: NgxMonacoEditorConfig) {}

  ngAfterViewInit(): void {
    if (loadedMonaco) {
      // Wait until monaco editor is available
      loadPromise.then(() => {
        this.initMonaco(this._options);
      });
    } else {
      loadedMonaco = true;
      loadPromise = new Promise<void>((resolve: any) => {
        if (typeof ((<any>window).monaco) === 'object') {
          resolve();
          return;
        }
        const baseUrl = (this.config.baseUrl || './assets') + '/monaco-editor/min/vs';
        const onGotAmdLoader: any = () => {
          // Load monaco
          (<any>window).require.config({ paths: { 'vs': `${baseUrl}` } });
          if (this.i18nLang && this.i18nLang != 'en')
            (<any>window).require.config({
              'vs/nls': {
                availableLanguages: {
                  '*': this.i18nLang
                }
              }
            });

          (<any>window).require([`vs/editor/editor.main`], () => {
            if (typeof this.config.onMonacoLoad === 'function') {
              this.config.onMonacoLoad();
            }
            this.initMonaco(this._options);
            resolve();
          });
        };

        // Load AMD loader if necessary
        if (!(<any>window).require) {
          const loaderScript: HTMLScriptElement = document.createElement('script');
          loaderScript.type = 'text/javascript';
          loaderScript.src = `${baseUrl}/loader.js`;
          loaderScript.addEventListener('load', onGotAmdLoader);
          document.body.appendChild(loaderScript);
        } else {
          onGotAmdLoader();
        }
      });
    }
  }

  protected abstract initMonaco(options: any): void;

  ngOnDestroy() {
    if (this._windowResizeSubscription) {
      this._windowResizeSubscription.unsubscribe();
    }
    if (this._editor) {
      this._editor.dispose();
      this._editor = undefined;
    }
  }

  protected afterMonacoInit() {
    // refresh layout on resize event.
    if (this._windowResizeSubscription) {
      this._windowResizeSubscription.unsubscribe();
    }
    this._windowResizeSubscription = fromEvent(window, 'resize')
      .pipe(debounceTime(this.resizeDebounceTimeMs))
      .subscribe(() => this._editor.layout())
    ;
    this.onInit.emit(this._editor);
  }
}
