import { mountConsultationForm } from './component.js?v=shared-form-1';

mountConsultationForm(document.getElementById('apply'), {
  token: new URLSearchParams(location.search).get('token'),
  onSubmitted: () => document.body.classList.add('submitted')
}).catch(console.error);
