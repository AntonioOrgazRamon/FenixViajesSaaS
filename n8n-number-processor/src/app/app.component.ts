import { Component, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { N8nService } from './services/n8n.service';
import { ProcessResponse } from './models/number-process.model';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  
  textContent: string = '';
  fileName: string = '';
  
  loading: boolean = false;
  error: string | null = null;
  response: ProcessResponse | null = null;

  constructor(private n8nService: N8nService) {}

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      this.fileName = file.name;
      const reader = new FileReader();
      reader.onload = (e) => {
        this.textContent = e.target?.result as string;
      };
      reader.readAsText(file);
    }
  }

  clearFile(): void {
    this.fileName = '';
    this.textContent = '';
    if (this.fileInput) {
      this.fileInput.nativeElement.value = '';
    }
  }

  processData(): void {
    if (!this.textContent.trim()) {
      this.error = 'Por favor, introduce texto o sube un archivo con números.';
      return;
    }

    this.loading = true;
    this.error = null;
    this.response = null;

    this.n8nService.processNumbers({ text: this.textContent }).subscribe({
      next: (res: any) => {
        this.loading = false;
        
        let data = res;
        if (Array.isArray(res)) data = res[0];
        if (data && data.json) data = data.json;
        else if (data && data.data) data = data.data;

        if (data && data.error) {
          this.error = data.error;
        } else if (data && data.crm_data) {
          this.response = data;
        } else {
            this.error = "Formato de respuesta inesperado. Asegúrate de usar el workflow V5 (CRM).";
        }
      },
      error: (err) => {
        this.loading = false;
        this.error = 'Error de conexión con el servidor n8n.';
        console.error(err);
      }
    });
  }
}
