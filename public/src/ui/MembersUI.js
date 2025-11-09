export class MembersUI {
  constructor(stateManager) {
    this.stateManager = stateManager;
    this.membersList = document.getElementById('members');
    this.membersSection = document.querySelector('.members');
    this.membersToggle = document.getElementById('membersToggle');
    this.membersBackdrop = document.getElementById('membersBackdrop');
    
    this.setupEventListeners();
    this.stateManager.subscribe('members', (members) => this.render(members));
  }

  setupEventListeners() {
    this.membersToggle.addEventListener('click', () => this.toggleMembers());
    this.membersBackdrop.addEventListener('click', () => this.closeMembers());
  }

  toggleMembers() {
    const isOpen = this.membersSection.classList.toggle('open');
    this.membersToggle.setAttribute('aria-pressed', isOpen);
    
    if (window.innerWidth <= 768) {
      document.body.style.overflow = isOpen ? 'hidden' : '';
      this.membersBackdrop.classList.toggle('active', isOpen);
    }
  }

  closeMembers() {
    this.membersSection.classList.remove('open');
    this.membersToggle.setAttribute('aria-pressed', 'false');
    this.membersBackdrop.classList.remove('active');
    document.body.style.overflow = '';
  }

  render(members) {
    this.membersList.innerHTML = members
      .map(member => `
        <li class="member-item">
          <div class="member-avatar">
            ${member.avatar 
              ? `<img src="${member.avatar}" alt="${member.name}" />` 
              : '<span>👤</span>'}
          </div>
          <div class="member-info">
            <div class="member-name">${this.escapeHTML(member.name)}</div>
            <div class="member-status">
              <span class="status status-${member.status}"></span>
              ${member.status}
            </div>
          </div>
        </li>
      `)
      .join('');
  }

  escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}