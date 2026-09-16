import { Directive, HostBinding, HostListener } from '@angular/core';

@Directive({
  selector: '[appHoverScale]',
})
export class HoverScaleDirective {
  @HostBinding('style.transform') transform = 'scale(1)';
  @HostBinding('style.transition') transition = 'transform 0.15s ease';

  @HostListener('mouseenter')
  onMouseEnter() {
    this.transform = 'scale(1.05)';
  }

  @HostListener('mouseleave')
  onMouseLeave() {
    this.transform = 'scale(1)';
  }
}
