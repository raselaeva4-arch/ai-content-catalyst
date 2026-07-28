UPDATE public.projects
SET user_id = 'b101f229-3cbf-4be2-bec8-d62753bf17ef'
WHERE id = '00000000-0000-0000-0000-000000000001' AND user_id IS NULL;

DELETE FROM public.projects
WHERE id = '28690939-b947-46fd-bd08-f0ce5046a66a';

ALTER TABLE public.projects ALTER COLUMN user_id SET NOT NULL;