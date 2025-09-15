import { ChangeDetectionStrategy, Component, EventEmitter, forwardRef, Inject, Input, NgZone, Output } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { fromEvent } from 'rxjs';

import { BaseEditor } from './base-editor';
import { NGX_MONACO_EDITOR_CONFIG, NgxMonacoEditorConfig } from './config';
import { NgxEditorModel } from './types';

import type * as Monaco from 'monaco-editor';

declare var monaco: typeof Monaco;

@Component({
  selector: 'ngx-monaco-editor',
  templateUrl: './base-editor.component.html',
  styleUrls: [ './base-editor.component.css' ],
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => EditorComponent),
    multi: true
  }],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EditorComponent extends BaseEditor<Monaco.editor.IStandaloneCodeEditor> implements ControlValueAccessor {
  
  get pristine() { return this._pristine; }

  get dirty() { return !this._pristine; }



  private _value: string = '';
  private _pristine: boolean = true;
  private initialValueVersionId: number;

  propagateChange = (_: any) => {};
  onTouched = () => {};

  @Input('options')
  set options(options: any) {
    this._options = Object.assign({}, this.config.defaultOptions, options);
    if (this._editor) {
      this._editor.dispose();
      this.initMonaco(options);
    }
  }

  get options(): any {
    return this._options;
  }

  @Input('model')
  set model(model: NgxEditorModel) {
    this.options.model = model;
    if (this._editor) {
      this._editor.dispose();
      this.initMonaco(this.options);
    }
  }

  @Output() onDidChangeModelContent = new EventEmitter<string>();

  constructor(private zone: NgZone, @Inject(NGX_MONACO_EDITOR_CONFIG) editorConfig: NgxMonacoEditorConfig) {
    super(editorConfig);
  }

  writeValue(value: any): void {
    this._value = value || '';
    // Fix for value change while dispose in process.
    // setTimeout(() => {
      if (this._editor) {
        if (this.options.model)
          console.warn('Not setting value from [ngModel] binding ([model] binding exists and value is not falsy)');
        else {
          this._editor.setValue(this._value);
          this.markAsPristine();
        }
      }
    // });
  }

  registerOnChange(fn: any): void {
    this.propagateChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  markAsPristine() {
    this.initialValueVersionId = this._editor.getModel().getAlternativeVersionId();
    this._pristine = true;
  }

  protected initMonaco(options: any): void {

    const hasModel = !!options.model;

    if (hasModel) {
      const model = monaco.editor.getModel(options.model.uri || '');
      if (model) {
        options.model = model;
        options.model.setValue(this._value);
      } else {
        options.model = monaco.editor.createModel(options.model.value, options.model.language, options.model.uri);
      }
    }

    this._editor = monaco.editor.create(this._editorContainer.nativeElement, options);

    if (!hasModel) {
      this._editor.setValue(this._value);
    }

    this.initialValueVersionId = this._editor.getModel().getAlternativeVersionId();
    this._pristine = true;

    this._editor.onDidChangeModelContent((e: any) => {
      const value = this._editor.getValue();

      // value is not propagated to parent when executing outside zone.
      this.zone.run(() => {
        this.propagateChange(value);
        this._value = value;
        this._pristine = (this.initialValueVersionId === this._editor.getModel().getAlternativeVersionId());
        this.onDidChangeModelContent.emit(value);
      });
    });

    this._editor.onDidBlurEditorWidget(() => {
      this.onTouched();
    });

    this.afterMonacoInit();
  }

}
