'use client';

import { useWizardStore } from '@/lib/stores/wizard-store';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Users, GraduationCap, Target } from 'lucide-react';

const targetAudiences = [
  { value: 'students', label: 'Students', icon: GraduationCap },
  { value: 'teachers', label: 'Teachers', icon: Users },
  { value: 'parents', label: 'Parents', icon: Users },
  { value: 'professionals', label: 'Professionals', icon: Target },
];

const gradeLevels = [
  { value: 'prek', label: 'Pre-K' },
  { value: 'k-2', label: 'Kindergarten - 2nd Grade' },
  { value: '3-5', label: '3rd - 5th Grade' },
  { value: '6-8', label: '6th - 8th Grade' },
  { value: '9-12', label: '9th - 12th Grade' },
  { value: 'college', label: 'College/University' },
  { value: 'adult', label: 'Adult Education' },
  { value: 'professional', label: 'Professional Development' },
];

const subjects = [
  'Mathematics',
  'Science',
  'English/Language Arts',
  'Social Studies',
  'History',
  'Geography',
  'Foreign Language',
  'Computer Science',
  'Art & Design',
  'Music',
  'Physical Education',
  'Business',
  'Marketing',
  'Other',
];

export function AudienceStep() {
  const { data, updateData } = useWizardStore();

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-semibold">Define Your Audience</h2>
        <p className="text-muted-foreground">
          Help us understand who will be using this document
        </p>
      </div>

      <div className="space-y-6">
        {/* Target Audience */}
        <div className="space-y-3">
          <Label className="text-base font-medium">
            Who is your target audience?
          </Label>
          <RadioGroup
            value={data.targetAudience || ''}
            onValueChange={(value) => updateData({ targetAudience: value })}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {targetAudiences.map((audience) => {
                const Icon = audience.icon;
                return (
                  <Card
                    key={audience.value}
                    className="cursor-pointer hover:border-primary transition-colors"
                  >
                    <label
                      htmlFor={audience.value}
                      className="flex items-center space-x-3 p-4 cursor-pointer"
                    >
                      <RadioGroupItem value={audience.value} id={audience.value} />
                      <Icon className="h-5 w-5 text-muted-foreground" />
                      <span className="font-medium">{audience.label}</span>
                    </label>
                  </Card>
                );
              })}
            </div>
          </RadioGroup>
        </div>

        {/* Grade Level */}
        <div className="space-y-3">
          <Label htmlFor="grade-level" className="text-base font-medium">
            What grade level or education stage?
          </Label>
          <Select
            value={data.gradeLevel || ''}
            onValueChange={(value) => updateData({ gradeLevel: value })}
          >
            <SelectTrigger id="grade-level">
              <SelectValue placeholder="Select grade level" />
            </SelectTrigger>
            <SelectContent>
              {gradeLevels.map((level) => (
                <SelectItem key={level.value} value={level.value}>
                  {level.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Subject */}
        <div className="space-y-3">
          <Label htmlFor="subject" className="text-base font-medium">
            What subject area? (Optional)
          </Label>
          <Select
            value={data.subject || ''}
            onValueChange={(value) => updateData({ subject: value })}
          >
            <SelectTrigger id="subject">
              <SelectValue placeholder="Select subject" />
            </SelectTrigger>
            <SelectContent>
              {subjects.map((subject) => (
                <SelectItem key={subject} value={subject.toLowerCase()}>
                  {subject}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Purpose */}
        <div className="space-y-3">
          <Label htmlFor="purpose" className="text-base font-medium">
            What&apos;s the purpose of this document? (Optional)
          </Label>
          <Textarea
            id="purpose"
            placeholder="e.g., Teaching fractions to 4th graders, Marketing presentation for clients, Study guide for biology exam..."
            value={data.purpose || ''}
            onChange={(e) => updateData({ purpose: e.target.value })}
            className="min-h-[100px]"
          />
          <p className="text-sm text-muted-foreground">
            Providing context helps our AI create more targeted enhancements
          </p>
        </div>
      </div>
    </div>
  );
}